// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "hardhat/console.sol";
import "./library/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ICOManager is ReentrancyGuard {
    using PRBMathUD60x18 for uint256;

    // Investor data
    struct ParticipationTicket {
        address stablecoinUsed;
        uint256 amount;
        uint256 endOfICO;
    }
    mapping(address => ParticipationTicket[]) public participationTickets;
    

    // Stablecoin vaults
    mapping(address => uint256) public vaultStablecoin; // stablecoins raised by successful ICO's
    mapping(address => uint256) public temporaryStablecoinVault; // stablecoins raised by still running ICO's
    mapping(uint256 => bool) public successICO; // true if ICO was successful

    address public owner;
    uint256 public exchangeRate; // how many stablecoins per ICOT

    mapping(address => bool) public stablecoinAddress; // whitelist stablecoins
    address[] public stablecoinAddrList;

    uint256 public minFunding; // 18 decimal
    uint256 public maxFunding;
    uint256 public timeLimit; // Time duration in seconds to reach funding

    uint256 public allocationToInvestors; // ex. 0.4 the rest remains in contract
    uint256 public fundImmediateTransfer; // % of the fund to be directly transfered to owner

    address public ICOTAddress;
    uint256 public ICOCurrent; // total amount available to be Offered

    uint256 public minICOTokens; // min tokens to be sold
    uint256 public maxICOTokens;

    bool public timeLimitReached = true; // dont start ICO immediately after deployment

    constructor(address _ICOTAddr, uint256 _fundImmediateTransfer) {
        require(
            fundImmediateTransfer < 1 * 10**18,
            "fundImmediateTransfer must be between 0-1"
        );

        owner = msg.sender;
        fundImmediateTransfer = _fundImmediateTransfer;
        ICOTAddress = _ICOTAddr;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    modifier ICOActive() {
        require(timeLimitReached == false, "ICO is not active");
        _;
    }

    // PreICO functions
    function startICO() private {
        require(allocationToInvestors <= 1 * 10**18, "ICO Amount !< 1");
        uint256 icotBalance = IERC20(ICOTAddress).balanceOf(address(this));

        minICOTokens = minFunding.div(exchangeRate); // 18-precision Decimal operation

        uint256 maxICOTpossible = icotBalance.mul(allocationToInvestors); // ICOT * 0.4 for max 40% of vault allocation to investors
        maxICOTokens = maxFunding.div(exchangeRate);

        require(
            maxICOTokens <= maxICOTpossible,
            "Increase allocation To Investors"
        );
        require(maxICOTokens > 0, "Not enough tokens in ICO Manager");
        timeLimitReached = false;
    }

    function setICOParameters(
        uint256 _exchangeRate,
        address[] memory _stablecoinAddr,
        uint256 _minFunding,
        uint256 _timeDuration,
        uint256 _maxFunding,
        uint256 _allocationToInvestors
    ) public onlyOwner {
        require(timeLimitReached, "ICO is already active");

        // Set list of stablecoin addresses which are accepted
        for (uint80 i = 0; i < _stablecoinAddr.length; i++) {
            stablecoinAddress[_stablecoinAddr[i]] = true;
            stablecoinAddrList.push(_stablecoinAddr[i]);
        }

        timeLimit = block.timestamp + _timeDuration;

        minFunding = _minFunding;
        maxFunding = _maxFunding;
        allocationToInvestors = _allocationToInvestors;
        exchangeRate = _exchangeRate;

        startICO();
    }

    // Intra ICO functions
    function checkTimeLimit() public ICOActive nonReentrant {
        // Can be called by anyone; possible to be gas-expensive

        if (block.timestamp > timeLimit) {
            if (ICOCurrent > minICOTokens) {
                // move coins from temporary vault to vault
                for (uint256 i = 0; i < stablecoinAddrList.length; i++) {
                    vaultStablecoin[
                        stablecoinAddrList[i]
                    ] += temporaryStablecoinVault[stablecoinAddrList[i]];
                    temporaryStablecoinVault[stablecoinAddrList[i]] = 0;
                }

                // ICO successful => immediate transfer to owner
                immediateTransfer();

                successICO[timeLimit] = true;
            } else {
                // unsuccessful ICO, empty the temporary vault, refund all investors
                for (uint256 i = 0; i < stablecoinAddrList.length; i++) {
                    temporaryStablecoinVault[stablecoinAddrList[i]] = 0;
                }

                successICO[timeLimit] = false;
            }
            resetICOParams();
            timeLimitReached = true;
        }
    }

    function participate(uint256 _amount, address _stablecoinAddr)
        public
        ICOActive
    {
        // check balances of stablecoin and ICOT
        require(_amount > 0, "Amount must be greater than 0");
        require(
            _amount + ICOCurrent <= maxICOTokens,
            "Not enough ICOT tokens available"
        );
        require(
            stablecoinAddress[_stablecoinAddr],
            "Stablecoin is not accepted"
        );
        require(
            IERC20(_stablecoinAddr).balanceOf(msg.sender) >=
                _amount.mul(exchangeRate),
            "Not enough stablecoin"
        );

        uint256 amountStablecoin = _amount.mul(exchangeRate);
        bool successfulTransfer = IERC20(_stablecoinAddr).transferFrom(
            msg.sender,
            address(this),
            amountStablecoin
        );
        require(successfulTransfer, "Stablecoin transfer failed"); 

        // Update ICO variables
        ICOCurrent += _amount;
        participationTickets[msg.sender].push(
            ParticipationTicket(_stablecoinAddr, _amount, timeLimit)
        );
        temporaryStablecoinVault[_stablecoinAddr] += amountStablecoin;

        // Allow investor to participate in ICO, although time is up
        // to prevent gas wasting
        checkTimeLimit();
    }

    // POST ICO FUNCTIONS

    function resetICOParams() private {
        for (uint80 i = 0; i < stablecoinAddrList.length; i++) {
            stablecoinAddress[stablecoinAddrList[i]] = false;
        }
        stablecoinAddrList = new address[](0);

        timeLimit = 0;

        minFunding = 0;
        maxFunding = 0;
        allocationToInvestors = 0;
        exchangeRate = 0;
        ICOCurrent = 0;
        minICOTokens = 0;
        maxICOTokens = 0;
    }

    // Investor should call this function to withdraw stablecoins/ICOT tokenss
    // Don't allow holding tokens or stablecoins between ICO's (security)
    function withdraw() public nonReentrant  {
        require(timeLimitReached == true, "ICO is still active");

        for (uint256 i = 0; i < participationTickets[msg.sender].length; i++) {
            // ICO was successful => transfer ICOT tokens to investor
            uint256 endOfICO = participationTickets[msg.sender][i].endOfICO;

            if (successICO[endOfICO] == true) {
                // Remove and pay ticket from participationTickets
                uint256 amountToTransfer = participationTickets[msg.sender][i]
                    .amount;
                
                IERC20(ICOTAddress).transfer(msg.sender, amountToTransfer);

                // Swap current and last ticket, and pop last ticket
                uint256 currentTicketsLength = participationTickets[msg.sender]
                    .length;
                address lastStablecoinUsed = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].stablecoinUsed;
                uint256 lastAmount = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].amount;
                uint256 lastEndOfICO = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].endOfICO;

                participationTickets[msg.sender][i] = ParticipationTicket(
                    lastStablecoinUsed,
                    lastAmount,
                    lastEndOfICO
                );
                participationTickets[msg.sender].pop();
            }
            // ICO unsuccessful, return Stablecoin
            else if (successICO[endOfICO] == false) {
                // Remove and pay ticket from participationTickets
                uint256 amountToTransfer = participationTickets[msg.sender][i]
                    .amount
                    .mul(exchangeRate);
                address stablecoinUsed = participationTickets[msg.sender][i]
                    .stablecoinUsed;
                IERC20(stablecoinUsed).transfer(msg.sender, amountToTransfer);

                // Swap current and last ticket, and pop last ticket
                uint256 currentTicketsLength = participationTickets[msg.sender]
                    .length;
                address lastStablecoinUsed = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].stablecoinUsed;
                uint256 lastAmount = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].amount;
                uint256 lastEndOfICO = participationTickets[msg.sender][
                    currentTicketsLength - 1
                ].endOfICO;

                participationTickets[msg.sender][i] = ParticipationTicket(
                    lastStablecoinUsed,
                    lastAmount,
                    lastEndOfICO
                );
                participationTickets[msg.sender].pop();
            }

            // Now last ticket is the current ticket, prevents underflow
            if(i > 0){
                i--;
            }
        }
    }

    // VAULT FUNCTIONS
    // Transfer % of stablecoin raised to owner immediately after ICO
    function immediateTransfer() private {
        // console.log("Transfering 20% funds to owner");
        for (uint80 i = 0; i < stablecoinAddrList.length; i++) {
            uint256 amountToTransfer = IERC20(stablecoinAddrList[i]).balanceOf(
                address(this)
            );
            amountToTransfer = amountToTransfer.mul(fundImmediateTransfer);

            bool transferedImmediate = IERC20(stablecoinAddrList[i]).transfer(
                owner,
                amountToTransfer
            );

            // permanent vault decreases
            vaultStablecoin[stablecoinAddrList[i]] -= amountToTransfer;
            require(
                transferedImmediate,
                "Failed to immediately transfer Stablecoin"
            );
        }
    }

    // Allow owner to transfer stablecoins when no ICO is active
    function transferStablecoin(
        address _stablecoinAddr,
        address _to,
        uint256 _amount
    ) public onlyOwner nonReentrant {
        require(timeLimitReached, "ICO in progress");
        bool transferSuccess = IERC20(_stablecoinAddr).transfer(_to, _amount);
        require(transferSuccess, "Failed to transfer Stablecoin");
    }

    // Change owner of the contract
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be empty");
        require(
            _newOwner != owner,
            "New owner cannot be the same as the old one"
        );
        owner = _newOwner;
    }
}
