### Documentation of the ICO DAO Contracts
1. Deployment scripts, located at **``./scripts``** <br>
***In the **``params.ts``** file all free-to-choose parameters of the Contracts are set.*** <br>
    **`VOTING_DELAY`** is the delay in blocks after proposal is made, but before voting starts. 1 block on ethereum is ususally 13.2 seconds. For all other chains, the corresponding block explorer (ie. Etherscan for Ethereum) can be used to determine average block duration. Blocks are the most reliable form of time estimation, because timestamps of the blocks can be slightly modified by miners (up to 15 seconds in the future and strictly timely after the last block). On other chains the timestamps may be more suseptable to manipulation, because of more concentrated (centralized) mining capability. Voting delay is generally between 1-3 days to allow participants to make themselves familiar with the proposal. <br>
    **`VOTING_PERIOD`** is the period in which voting on the proposal is allowed, after the **`VOTING_DELAY`** is elapsed. Here a good rule of thumb is to allow for 5/7/10 days vote. Voting duration depends on the size of the protocol. The more well known a protocol is, the shortest voting interval it needs, because the holders of the governance token are tracking happenings arond their investment more thoughrouly.<br>
    **`MIN_VOTES_TO_PROPOSE`** is the amount of tokens (in 10^18) needed for a proposal to be made. Here in params.ts only a starting value is defined. This value can be changed through a vote to represent a percentage of the total supply of the governance token. <br>
    **`QUORUM_PERCENTAGE`** This is the relative percentage needed for a vote to be considered valid. Toward quorum are counted negative, positive as well as ABSTAIN votes. <br>
    **`MIN_DELAY`** After a vote ends, the weight of the execution is passed from the governance contract (where voting is performed) to a timelock Contract, which performs executions. The contracts of ICO DAO are set so the Timelock can be changed through a vote, but also the Governance Contract can be changed. This will again be performed by a democratic vote. After a vote ends and is passed, the action can be performed by every address, regardless of the amount of tokens it has. Actions can be performed only after a **`MIN_DELAY`** elapses, to allow people, who are not in agreement with the changes being made, to exit the protocol. <br>
    **`ICOT_NAME`** is the full name of the governance/economic token. This name will be shown in Scaners (ie Etherscan) and on CEX (centralized exchanges). <br>
    **`ICOT_SYMBOL`** is the ticker of the token. Similar to AAPL in the case of the Apple Corporation <br>
    **`immediateTransferRateBig`** is the initial coefficient of immediate transfer upon successful ICO. 0.2 will correspond to 20% of stablecoins will be immediately transfered to the DAO Governance Contract upon successful ICO. This value, as well as the others, can be changed through a democratic vote. <br><br>


    ***In the **``deploy.ts``** deployments to mainnet are made. These deployment actions are supported by every EVM compatible blockchain*** <br><br>

    First the Hardhat runtime and the environment variables are imported (Private & Public key of the wallet): <br>

    ```js
    import hre from "hardhat";
    import * as dotenv from "dotenv";
    ```

    Deployments are performed always in the same manner: The contract ABI is taken from declarations of the solidity files, then is deployed with constructor arguments and after successful deployment, the mainnet address is logged in the console:

    ```js
    const ICOT = await ethers.getContractFactory("ICOT");
    const ICOTContract = await ICOT.deploy(ICOT_NAME, ICOT_SYMBOL);
    await ICOTContract.deployed();

    console.log("Voting token deployed to:", ICOTContract.address);
    ```

    After the 4 Contracts are deployed, addresses are logged in json file `contract-address.json`. These addresses will be needed for the verification. Addresses can be viewed in the Etherscan (or equivalent) scanner: 

    ```js
    const addressData = {
    icoToken: ICOTContract.address,
    timelock: timelockContract.address,
    governor: governorContract.address,
    icoManager: icoManagerContract.address,
    };

    writeFileSync("./scripts/contract-address.json", JSON.stringify(addressData));
    ```

    What follows is a series of ownership transfers to the timelock Contract (executor of the voting decisions). At this time the owner is either not set, or set to the deployer address. Roles for executor, etc. are set here as well. After each transaction, we will wait 1 Block confirmation to avoid failed transaction, reordering, etc. This part of the code is not critical and can be executed block by block. At this time the ICO Contracts are still not usable: 

    ```js 
    // Transfer ownerships to Timelock
    const proposerRole = await timelockContract.PROPOSER_ROLE();
    const executorRole = await timelockContract.EXECUTOR_ROLE();
    const adminRole = await timelockContract.TIMELOCK_ADMIN_ROLE();

    // Only Govenor can propose to timelock
    // (timelock will execute everything after delay)
    const proposerTx = await timelockContract.grantRole(
      proposerRole,
      governorContract.address
    );
    await proposerTx.wait(1);

    // Anybody can execute proposal after voting has passed
    const executorTx = await timelockContract.grantRole(
      executorRole,
      ethers.constants.AddressZero
    );
    await executorTx.wait(1);

    // Deployer owns timelock; revoke ownership
    const revokeTx = await timelockContract.revokeRole(
      adminRole,
      process.env.PUBKEY || ""
    );
    revokeTx.wait(1);

    // Revoke ICO Manager ownership to timelock
    const transferOwnerTx = await icoManagerContract.transferOwnership(
      timelockContract.address
    );
    await transferOwnerTx.wait(1);
    ```

    At the end of deployment, the ICO Token is deployed. It's ownership has too to be transfered to the Timelock contract, but the total supply (ie. balances) is still 0. This will mean that no voting can be performed. To avoid such comical situation, the first deployer is automatically granted the minimum tokens needed for a proposal. He can then go on to propose a mint to people critical for the success of the protocol, or airdrop tokens, or something else, to distribute tokens to new stakeholders. As such, the first vote is guaranteed to pass. He is free in his decision on how and how many tokens to distribute: 

    ```js
    // Mint min tokens to propose to owner 
    // and transfer ICOT ownership to timelock
     await ICOTContract.mint(process.env.PUBKEY || "", MIN_VOTES_TO_PROPOSE);
     const transferICOT = await ICOTContract.transferOwnership(timelockContract.address);
     await transferICOT.wait(1);
    ```
    At the end of the deployment script, there is a 10 block wait time. The next step is to validate all deployed contracts on Etherscan. On services like scanners, we can submit the code of our smart contracts and have it verified. The scanner verifies code by compiling it and checking the compiled bytecode (or machine code) with the bytecode on-chain: 

    ```js
    // Wait 10 blocks to allow solidity code to get
    // on etherscan backend
    await governorContract.deployTransaction.wait(10); 
    ```

    <br>

    ***In the **``verify-*.ts``** files the smart contract code will be submitted to Etherscan (or another) and verified on their servers.*** <br>
    The structure of the verification process is similar for all files. We will take as example **``verify-erc20.ts``** which verifies the governance token code of the project. First we import parameters used for the deployment. To achieve the same bytecode as our deployed contract, we need to provide constructor params as well. The target address of the verification process will be our contract address:

    ```js
    import {
    ICOT_NAME,
    ICOT_SYMBOL,
    } from "./params";
    const rawData = readFileSync("./contract-address.json", "utf8");
    const jsonData = JSON.parse(rawData);
    ```
    The verification process is part of the hardhat verify package (available through npm/yarn) and is connected with the hardhat runtime environment. We specify a contract where our code is located, and submit with a etherscan key (defined in the `hardhat.config.ts`) our code to the backend: 

    ```js
    await hre.run("verify:verify", {
    address: icotAddress,
    constructorArguments: [ICOT_NAME, ICOT_SYMBOL],
    contract: "contracts/ico/ICOT.sol:ICOT",
    });
    ```

    Verification is similar to deployment and the same for all of our contracts. Depending on the scaner (ie on Avax, Polygon, etc) the API key is the only difference in the code. <br> <br>

    ***The **``contract-address.json``** file contains the addresses (pointers in hex) to all deployed contracts*** <br><br><br>

2. Contracts, located at **``./contracts``** <br>
    * The **``ico``** folder contains independant contract, regulating the ICO process
    * The **``dao``** folder contains independant contract, establishing DAO governance on-chain
    * The **``mocks``** folder contains mocks of 4 popular stablecoins (now one of them in the process of failure / rebirth? ), and a mock contract used for DAO functional verification.
    * The **``library``** folder contains contracts that enable us to perform floating point arithmetic on-chain with up to the full 18 decimal precision.

    <br>

    ***The **``DAIMock.sol``** file contains ERC20 mock of the popular algorithmic stablecoin DAI***
    Minting is allowed for the owner (in that case the deployer) of the contract. As this is used for testing purposes, the mint function is ignored.
    <br>

    ```js
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    ```

    The other stablecoin mocks have similar behaivior. Only names and tickers differentiate between them. Validations are performed in all test files. 

    <br>
    
    ***The **``Box.sol``** is a mock used to verify the functions of a DAO Governance***
    It stores a uint value. The value can be changed by the owner (Timelock contract in our tests) or retrieved by anyone. A Event is emitted upon change in value. Validation is performed in the `dao-functionality.ts` test file.
    <br>

    ```js
    // Stores a new value in the contract
    function store(uint256 newValue) public onlyOwner {
        value = newValue;
        emit ValueChanged(newValue);
    }
    ```
    <br>

    ***The **``ICOT.sol``** is the governance / economic token, used for operation of the DAO.***
    It exhibites normal ERC20 token behavior, as well as Voting functionality. It is wrapped in the ERC20Votes contract by OpenZeppelin, which allows for 1-way voting system where 1 token is used for voting (not lost during the voting process) and the same token can be used for day-to-day economic operations. It has owner (transfered to Timelock during deployment) and constructor, that establishes it's name and ticker symbol: 

    <br>

    ```js
    address public owner;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        owner = msg.sender;
    }
    ```

    Furthermore the contracts prevents unauthorized access by utilizing modifiers. There are 2 more functions, differing from the OpenZeppelin vanilla implementation (docs for the OpenZeppelin contract, that we are inheriting from, are available on their website under ERC20 Documentation). We allow for transfers of ownership and fluctuating total supply. Thats because we want to increase the token supply, as the usage of the protocol increases (in a way similar to stocks in a company). Increasing supply dillutes existing holders, so it should be performed with care. The strategy, defined for the ICO Manager contract allows only for token exchanges after a sum in stablecoins is deposited in the Contract.

    ```js
    // Change owner of the contract
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be empty");
        require(
            _newOwner != owner,
            "New owner cannot be the same as the old one"
        );
        owner = _newOwner;
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
    ```

    <br>

    ***The **``ICOManager.sol``** is the main entry point for ICO's to be performed.***
    Because the code is extensive, here we will only take look at function signatures and explain how they should perform. Inside the functions, there are comments available to help the user navigate them. At first we are including floating point operations library:

    ```js
    using PRBMathUD60x18 for uint256;
    ```

    <br>
    The investors data is stored in a struct. Each time investor buys tokens from the contract, his `ParticipationTickets` array is appended with a new Participation Ticket. We will record the address of the stablecoin used, the amount of ICOT tokens, that the investor has purchased and the time the ICO will end. By the time it ends, we can determine at any time if it was: successful, unsuccessful or if it's still in progress. Based on that, we will either give him his stablecoins back (if unsuccessful), give him amount of ICOT tokens (if successful) or deny withdraw action, if the ICO is still in progress. This array can become so large, that a investor will run out of gas if he attempts withdraw. That happens if he performs ~500 distinct buy orders within a single ICO. Because the typical investor won't have the time to attempt such a large frequency of orders, we will not address this problem. This allows us to use multipe stablecoins from the same investor. If the ICO is under a week in duration, the >500 order problem won't affect even the bots. If investor is affected, he will be the only one that suffers consequences. The contract will be able to continue functioning.

    ```js 
    // Investor data
    struct ParticipationTicket {
        address stablecoinUsed;
        uint256 amount;
        uint256 endOfICO;
    }
    mapping(address => ParticipationTicket[]) public participationTickets;
    ```

    <br>

    The stablecoin vaults are defined next. Each stablecoin address is assigned to number, that represents the current balance in the contract. The `vaultStablecoin` is the permanent amount in the smart contract (the amount of stablecoin received on successful ICOs), the `temporaryStablecoinVault` are full with stablecoins used on the current ICO. These stablecoins are in a temporary vault, because if the ICO fails, they need to be returned to investors. The owner of the ICO Manager Vault has rights to transfer only the `vaultStablecoin` which is full with stablecoin from successful ICOs. The `successICO` mapping assigns timestamps to a bool (true / false) if the ICO was successful. The timestamp is always the ending time of an ICO and set after the ICO has ended. This leads to all ICOs that have not finished, to be seen as not successful.

    <br>

    ```js
     // Stablecoin vaults
    mapping(address => uint256) public vaultStablecoin; // stablecoins raised by successful ICO's
    mapping(address => uint256) public temporaryStablecoinVault; // stablecoins raised by still running ICO's
    mapping(uint256 => bool) public successICO; // true if ICO was successful
    ```

    <br>

    The owner and exchangeRate are kept here as public variables, visible to all on-chain participants. `exchangeRate` corresponds to how many USD cost to buy 1 ICOT.

    ```js
    address public owner;
    uint256 public exchangeRate; // how many stablecoins per ICOT
    ```

    Here the stablecoins, available for use in the ICO are defined. `stablecoinAddress` returns true if the stablecoin is whitelisted and purchases with it are allowed. `stablecoinAddrList` includes all stablecoins that are whitelisted for the current ICO.

    ```js
    mapping(address => bool) public stablecoinAddress; // whitelist stablecoins
    address[] public stablecoinAddrList;
    ```

    The following code defines `minFunding` in USD for the ICO to be considered success, and `maxFunding` in USD that defines how much ICOT maximally can be sold. So if max funding were to be 100 USD and the exchange rate 4 USD per ICOT coin, only 25 coins can be sold maximally. These values are defined in USD to make operations for investors easy.

    ```js 
    uint256 public minFunding; // 18 decimal
    uint256 public maxFunding;
    uint256 public timeLimit; // Time duration in seconds to reach funding
    ```

    `allocationToInvestors` defines what is the maximal part of the contract ICOT reserve that can be auctioned to investors. In this scenario 0.4 will mean 40% of the ICOT in contract can be auctioned to investors. If there were 100 ICOT, this will equal maximum of 40 ICOT tokens for investors. This value can be set to 1 to avoid complicated calculations, but if the reserve was to become large and valueable, it's best to have this allocation as a limit.

    ```js
    uint256 public allocationToInvestors; // ex. 0.4 the rest remains in contract
    uint256 public fundImmediateTransfer; // % of the fund to be directly transfered to owner
    ```

    The following code defines the address of the ICOT token in `ICOTAddress` and the `ICOCurrent` as the amount of ICOT already being sold in the current ICO. Further along `minICOTokens` and `maxICOTokens` track the two limits similar to the limits in USD above, but here they are tracked in ICOT tokens.

    ```js
        address public ICOTAddress;
    uint256 public ICOCurrent; // total amount available to be Offered

    uint256 public minICOTokens; // min tokens to be sold
    uint256 public maxICOTokens;
    ```

    When the time limit of an ICO is reached, the owner will have larger priviledges. This is tracked by the variable `timeLimitReached` initially set to `true` as there is no automatic ICO being started upon deployment. If this variable is true, the owner can withdraw, set parameters for future ICO's and so on:

    ```js
    bool public timeLimitReached = true; // dont start ICO immediately after deployment
    ```

    The constructor sets two parameters- the ICO token address and the immediate transfer of stablecoin to the owner upon successful ICO. The owner is set to the deployer.

    ```js
    onstructor(address _ICOTAddr, uint256 _fundImmediateTransfer) 
    ```

    The following modifiers are defined. `onlyOwner` expects that the caller is the owner and `ICOActive` expects that ICO is in progress:

    ```js 
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    modifier ICOActive() {
        require(timeLimitReached == false, "ICO is active");
        _;
    }
    ```

    Here Pre-ICO functions are defined. They should be called upon starting of the ICO. In this scenario, `setICOParameters` is called and `startICO` is also automatically called as private function: 

    ```js
    function setICOParameters(
        uint256 _exchangeRate,
        address[] memory _stablecoinAddr,
        uint256 _minFunding,
        uint256 _timeDuration,
        uint256 _maxFunding,
        uint256 _allocationToInvestors
    ) public onlyOwner {...}

    function startICO() private {...}
    ```

    After these 2 functions are called, a ICO is in progress. During the ICO, to participate, investors can call `participate`, after approving the ICO Manager contract to spent stablecoin on their behalf. The `checkTimeLimit` function is called after successful participation. It can be called by itself too, since it's public. 

    ```js

    function checkTimeLimit() public ICOActive nonReentrant {...}

    function participate(uint256 _amount, address _stablecoinAddr)
        public
        ICOActive {...}
    ```

    After `checkTimeLimit` is called, it will automatically reset the ICO Parameters, if the ICO time has elapsed and it has ended. The function is private, since it's called only once by another function in the contract.

    ```js
    function resetICOParams() private {...}
    ```

    Investors can call the function `withdraw` without passing any arguments. This function will automatically transfer all their eligable for withdraw ICOT tokens, and all Stablecoins that deposited, but the ICOs of which were not successful. This function can be only called when there is no active ICO in progress.

    ```js 
    function withdraw() public nonReentrant  {...}
    ```

    The vault operations include function `immediateTransfer` to give the owner of the ICO Manager some portion of the stablecoin raised during the offering immediately upon the ending of the ICO. This function will be called when the ICO ends, automatically. 

    ```js
    function immediateTransfer() private {...}
    ```

    The owner can transfer the stablecoins, raised in a successful ICO, freely: 
    
    ```js 
    function transferStablecoin(
        address _stablecoinAddr,
        address _to,
        uint256 _amount
    ) public onlyOwner nonReentrant { ... }
    ```

    The owner of the contract can be changed. This is needed because Timelocks of the Governance can change and the deployer should be able to transfer the ownership of the contract to the Timelock upon initial deployment.

    ```js 
    function transferOwnership(address _newOwner) public onlyOwner { ... }
    ```

    ***A Note on security.***
    There are modifiers and functions we have glossed over in this documentation. Things like the `nonReentrant` modifier, vetted by OpenZeppelin, prevent some of the bugs, known to us and used in exploits in the past. The ICO Contracts are most susseptable to security flaws and this should be considered at all times. The code on-chain is public and this only eliminates one barrier the hackers face- *"Security through obscurity"* This is not something to take lightly, when money is at direct stake.

    ***The **``Governor.sol``** is the voting manager contract of the project. Votes & proposals take place here***

    The Governor contract inherits from 6 OpenZeppelin Contracts, many of which depend on each other (complete documentation of why we have included these to fulfill the ICO functionality can be found on the OpenZeppelin site). In the constructor, we point the Governor to the Token, used for voting, we pass additionaly `delayBeforeVotingStarts` `votingDurationInBlocks`, all times in the Governor are in blocks. `minTokensToCreate`, which is absolute (not percentage) value in Tokens (10^18). `quorumPercent` defines minimum voting participation for a vote to be considered valid.
    
    ```js 
    constructor(
        IVotes _token,
        TimelockController _timelock,
        uint256 delayBeforeVotingStarts,
        uint256 votingDurationInBlocks,
        uint256 minTokensToCreate,
        uint256 quorumPercent
    ) {...}
    ```

    The function `votingDelay` returns the delay in blocks before voting on a proposal starts

    ```js 
    function votingDelay() {...}
    ```
    
    The function `votingPeriod` returns the period in blocks, that voters have to exercise their vote on a proposal after the votingDelay has elapsed.

    ```js 
    function votingPeriod() {...}
    ```

    The `quorum` function returns number of votes (absolute) valid as of certain block and needed for a vote to pass.

    ```js 
    function quorum(uint256 blockNumber)
        public
        view {...}
    ```

    The `state` function returns a state of the proposal. For more details on how to parse the struct, head over to the DAO tests, where examples are present.

    ```js
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState) {...}
    ```

    The `propose` function takes as arguments calldata, which can be used to address every possible action. For some examples on how to use it, head over to the test files.

    ```js
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) { ... }
    ```

    The number of votes required in order for a voter to become a proposer.

    ```js
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    ```









