// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "hardhat/console.sol";
import "./library/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ICOManager is ReentrancyGuard {
    using PRBMathUD60x18 for uint256;

    address public owner;
    uint256 public exchangeRate; // how many stablecoins per ICOT

    mapping(address => bool) public stablecoinAddress; // whitelist stablecoins
    address[] public stablecoinAddrList;

    uint256 public minFunding; // 18 decimal
    uint256 public maxFunding;
    uint256 public timeLimit; // Time duration in seconds to reach funding

    uint256 public allocationToInvestors; // ex. 0.4 the rest remains in contract
    uint256 public fundImmediateTransfer; // % of the fund to be directly transfered to owner

    mapping(address => uint256) public investorsAmounts;
    address[] public investorsAddresses;
    mapping(address => address) public stablecoinUsed;

    address public ICOTAddress;
    uint256 public ICOCurrent; // total amount available to be Offered

    uint256 public minICOTokens; // min tokens to be sold
    uint256 public maxICOTokens;

    bool public timeLimitReached = true; // dont start ICO immediately after deployment

    constructor(address _ICOTAddr, uint256 _fundImmediateTransfer) {
        require(fundImmediateTransfer < 1 * 10**18, "fundImmediateTransfer must be between 0-1");

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
        require(timeLimitReached == false, "ICO is active");
        _;
    }

    // PreICO functions
    function startICO() private {
        require(allocationToInvestors < 1*10**18, "ICO Amount !< 1");
        uint256 icotBalance = IERC20(ICOTAddress).balanceOf(address(this));

        minICOTokens = minFunding.div(exchangeRate); // 18-precision Decimal operation
        
        uint256 maxICOTpossible = icotBalance.mul(allocationToInvestors); // ICOT * 0.4 for max 40% of vault allocation to investors
        maxICOTokens = maxFunding.div(exchangeRate); 

        require(maxICOTokens < maxICOTpossible, "Increase allocation To Investors");
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
        console.log("TimeLimit check");

        if (block.timestamp > timeLimit) {
            if (ICOCurrent > minICOTokens) {
                console.log("ICO successful");

                allocateCoinsToInvestors();
            } else {
                console.log("ICO not successful");

                returnStablecoinsToInvestors();
            }
            resetICOParams();
            timeLimitReached = true;
        } 
    }

    function participate(uint256 _amount, address _stablecoinAddr)
        public
        ICOActive()
    {
        if(stablecoinUsed[msg.sender] != address(0)){
            // one stablecoin per investor 
            require(stablecoinUsed[msg.sender] == _stablecoinAddr, "Only consistent stablecoin allowed");
        } 

        require(_amount > 0, "Amount must be greater than 0");
        require(_amount + ICOCurrent <= maxICOTokens, "Not enough tokens available");
        require(
            stablecoinAddress[_stablecoinAddr],
            "Stablecoin is not accepted"
        );
        require(
            IERC20(_stablecoinAddr).balanceOf(msg.sender) >=
                _amount.mul(exchangeRate),
            "Not enough tokens in stablecoin"
        );

        IERC20(_stablecoinAddr).transferFrom(
            msg.sender,
            address(this),
            _amount.mul(exchangeRate)
        );
        ICOCurrent += _amount;
        investorsAmounts[msg.sender] += _amount;
        investorsAddresses.push(msg.sender);

        // After successful transfer, set the stablecoin used
        stablecoinUsed[msg.sender] = _stablecoinAddr;

        // Allow investor to participate in ICO, although time is up
        // to prevent gas wasting 
        checkTimeLimit();
    }

    // Post ICO functions
    function allocateCoinsToInvestors() private {
        for (uint80 i = 0; i < investorsAddresses.length; i++) {
            uint256 amountToTransfer = investorsAmounts[investorsAddresses[i]];

            bool transferedICOT = IERC20(ICOTAddress).transfer(
                investorsAddresses[i],
                amountToTransfer
            );
            require(transferedICOT, "Failed to transfer ICOT");

            investorsAmounts[investorsAddresses[i]] = 0;
            stablecoinUsed[investorsAddresses[i]] = address(0);
        }

        // reset investors list
        investorsAddresses = new address[](0);
        immediateTransfer();
    }

    function returnStablecoinsToInvestors() private {
        for (uint80 i = 0; i < investorsAddresses.length; i++) {
            uint256 amountToTransfer = investorsAmounts[investorsAddresses[i]]
                .mul(exchangeRate);
            address stablecoinAddr = stablecoinUsed[investorsAddresses[i]];

            bool transferedICOT = IERC20(stablecoinAddr).transfer(
                investorsAddresses[i],
                amountToTransfer
            );

            require(transferedICOT, "Failed to transfer Stablecoin");
            investorsAmounts[investorsAddresses[i]] = 0;

            // Remove stablecoin record
            investorsAmounts[investorsAddresses[i]] = 0;
            stablecoinUsed[investorsAddresses[i]] = address(0);
        }

        // reset investors list
        investorsAddresses = new address[](0);
    }

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

    // Vault functions
    function immediateTransfer() private {
        console.log("Transfering 20% funds to owner"); 
        for (uint80 i = 0; i < stablecoinAddrList.length; i++) {
            uint256 amountToTransfer = IERC20(stablecoinAddrList[i]).balanceOf(address(this));
            amountToTransfer = amountToTransfer.mul(fundImmediateTransfer);

            bool transferedImmediate = IERC20(stablecoinAddrList[i]).transfer(owner, amountToTransfer);
            require(transferedImmediate, "Failed to immediately transfer Stablecoin");
        }
    }

    function transferStablecoin(address _stablecoinAddr, address _to, uint256 _amount) public onlyOwner() nonReentrant {
        require(timeLimitReached, "ICO in progress");
        bool transferSuccess = IERC20(_stablecoinAddr).transfer(_to, _amount);
        require(transferSuccess, "Failed to transfer Stablecoin");
    }
}
