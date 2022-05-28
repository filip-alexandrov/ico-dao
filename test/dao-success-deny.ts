/* eslint-disable */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Contract, ContractFactory, Signer, Wallet } from "ethers";
import { encode } from "punycode";
import { Filter } from "ethers/node_modules/@ethersproject/providers";

describe.only("DAO ICO Manager proposals", function () {
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    other: SignerWithAddress[];

  // ICOT Token params
  let tokenName: String = "ICO Token";
  let tokenSymbol: String = "ICOT";

  // ICO Manager params
  let exchangeRate: number = 4; // $4 for every ICOT token
  let stableCoinAddress: String;
  let maxFunding: number = 165; // $165 max funding of the 1. ICO
  let minFunding: number = 100;
  let allocationToInvestors = 0.4; // max 40% of tokens available in ICO Manger's vault will be ICOed
  let immediateTransferRate = 0.2; // 20% send immediately to owner upon successful ICO
  let timeDuration = 1000; // ICO duration in seconds

  // Prepare numbers
  let exchangeRateBig = ethers.utils.parseEther(exchangeRate.toString());
  let maxFundingBig = ethers.utils.parseEther(maxFunding.toString());
  let minFundingBig = ethers.utils.parseEther(minFunding.toString());
  let allocationToInvestorsBig = ethers.utils.parseEther(
    allocationToInvestors.toString()
  );
  let immediateTransferRateBig = ethers.utils.parseEther(
    immediateTransferRate.toString()
  );

  // Contract Factory Definitions
  let Icot: ContractFactory;
  let icotContract: Contract;
  let icotAddress: String;

  let Governor: ContractFactory;
  let governorContract: Contract;
  let governorAddress: String;

  let Timelock: ContractFactory;
  let timelockContract: Contract;
  let timelockAddress: String;

  let icoManager: ContractFactory;
  let icoManagerContract: Contract;
  let icoManagerAddress: String;

  let Dai: ContractFactory;
  let daiContract: Contract;
  let daiAddress: String;

  // Utils
  let oneToken = ethers.utils.parseEther("1");
  let proposals: string[] = [];

  // Constants
  let MIN_DELAY = 3600; // after successful vote, queue execution
  let VOTING_PERIOD = 5; // #blocks
  let QUORUM_PERCENTAGE = 4;
  let VOTING_DELAY = 1; // 1 block till proposal voting begins
  let MIN_VOTES_TO_PROPOSE = oneToken.mul(4); // min tokens to propose

  let FUNC_MINT: string;
  let VALUES_MINT: any[];

  let FUNC: string;
  let VALUES: any[];
  let PROPOSAL_DESCRIPTION: string;

  before(async function () {
    [owner, addr1, addr2, addr3, ...other] = await ethers.getSigners();

    // Main economic & voting token
    Icot = await ethers.getContractFactory("ICOT");
    icotContract = await Icot.deploy(tokenName, tokenSymbol);
    icotAddress = icotContract.address;

    // Mock stablecoin
    Dai = await ethers.getContractFactory("DAI");
    daiContract = await Dai.deploy();
    daiAddress = daiContract.address;

    // Voting mechanism
    Timelock = await ethers.getContractFactory("Timelock");
    timelockContract = await Timelock.deploy(MIN_DELAY, [], []);
    timelockAddress = timelockContract.address;

    Governor = await ethers.getContractFactory("ICOGovenor");
    governorContract = await Governor.deploy(
      icotAddress,
      timelockAddress,
      VOTING_DELAY,
      VOTING_PERIOD,
      MIN_VOTES_TO_PROPOSE,
      QUORUM_PERCENTAGE
    );
    governorAddress = governorContract.address;

    // ICO Conrolling contract and vault
    icoManager = await ethers.getContractFactory("ICOManager");
    icoManagerContract = await icoManager.deploy(
      icotAddress,
      immediateTransferRateBig
    );
    icoManagerAddress = icoManagerContract.address;

    // Set owner of the timelock
    const proposerRole = await timelockContract.PROPOSER_ROLE();
    const executorRole = await timelockContract.EXECUTOR_ROLE();
    const adminRole = await timelockContract.TIMELOCK_ADMIN_ROLE();

    // Only Govenor can propose to timelock
    // (timelock will execute everything after delay)
    const proposerTx = await timelockContract.grantRole(
      proposerRole,
      governorAddress
    );
    await proposerTx.wait(1); // 1 block wait

    // Anybody can execute proposal after voting
    const executorTx = await timelockContract.grantRole(
      executorRole,
      ethers.constants.AddressZero
    );
    await executorTx.wait(1);

    // Deployer owns timelock; revoke ownership
    const revokeTx = await timelockContract.revokeRole(
      adminRole,
      owner.address
    );
    revokeTx.wait(1);

    // Revoke ICO Manager ownership
    const transferOwnerTx = await icoManagerContract.transferOwnership(
      timelockAddress
    );
    await transferOwnerTx.wait(1);

    // Utils
    FUNC_MINT = "mint";
    VALUES_MINT = [icoManagerContract.address, maxFundingBig];

    FUNC = "setICOParameters";
    VALUES = [
      exchangeRateBig,
      [daiContract.address],
      minFundingBig,
      timeDuration,
      maxFundingBig,
      allocationToInvestorsBig,
    ];
    PROPOSAL_DESCRIPTION = "Set params of ICO";
  });

  it("Tokens : Owner 60, Addr1 37, Addr2 3", async function () {
    // Delegate should be called once only to activate
    // voting functionality; thereafter- auto checkpoints

    await icotContract.mint(owner.address, oneToken.mul(60));
    await icotContract.mint(addr1.address, oneToken.mul(37));
    await icotContract.mint(addr2.address, oneToken.mul(3));

    await icotContract.delegate(owner.address);
    await icotContract.connect(addr1).delegate(addr1.address);
    await icotContract.connect(addr2).delegate(addr2.address);

    expect(await icotContract.numCheckpoints(owner.address)).to.equal(1);
    expect(await icotContract.numCheckpoints(addr1.address)).to.equal(1);
    expect(await icotContract.numCheckpoints(addr2.address)).to.equal(1);
  });

  it("Transfers ownership of ICOT to DAO", async function () {
    await icotContract.transferOwnership(timelockAddress);

    const owner = await icotContract.owner();
    expect(owner).to.equal(timelockAddress);
  });

  it("ICO Manager has initial params", async function () {
    expect(await icoManagerContract.timeLimit()).to.equal(0);
    expect(await icoManagerContract.minFunding()).to.equal(0);
    expect(await icoManagerContract.maxFunding()).to.equal(0);
    expect(await icoManagerContract.exchangeRate()).to.equal(0);

    expect(await icoManagerContract.allocationToInvestors()).to.equal(0);
    await expect(icoManagerContract.stablecoinAddrList(0)).to.be.reverted;
    expect(await icoManagerContract.ICOTAddress()).to.equal(icotAddress);
  });

  it("Governor has right quorum", async function () {
    // 4% quorum rate on block before
    let latestBlock = await ethers.provider.getBlock("latest");
    let prevBlockNumber = latestBlock.number - 1;

    expect(await governorContract.quorum(prevBlockNumber)).to.be.equal(
      oneToken.mul(4)
    );
  });

  it("Governor has right voting delay, period, timelock", async function () {
    expect(await governorContract.votingDelay()).to.be.equal(1);
    expect(await governorContract.votingPeriod()).to.be.equal(5);

    // in seconds
    expect(await timelockContract.getMinDelay()).to.be.equal(3600);
  });

  it("Timelock has right delay", async function () {
    expect(await timelockContract.getMinDelay()).to.be.equal(3600);
  });

  it("Addr2 can't propose parameters of new ICO", async function () {
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    await expect(
      governorContract.connect(addr2).propose(
        [icoManagerContract.address], // Target addresses
        [0], // ETH to send, mapped to addresses
        [encodedFunctionCall], // mapped to addresses
        PROPOSAL_DESCRIPTION
      )
    ).to.be.revertedWith("Governor: proposer votes below proposal threshold");
  });

  it("Addr1 proposes successfully", async function () {
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    const proposeTx = await governorContract.connect(addr1).propose(
      [icoManagerContract.address], // Target addresses
      [0], // ETH to send, mapped to addresses
      [encodedFunctionCall], // mapped to addresses
      PROPOSAL_DESCRIPTION
    );

    const proposeReceipt = await proposeTx.wait(1);
    const proposalId = proposeReceipt.events[0].args.proposalId;
    proposals.push(proposalId.toString());
  });

  it("ICOT Token transfer events", async function () {
    // listen for ICOT transfer to addresses
    // starting from blocknumber 0

    let filter: Filter = {
      address: icotContract.address,
      topics: [
        // keccak hash of the event == topics[0]
        ethers.utils.id("Transfer(address,address,uint256)"),
        null, // from all addresses
        [
          ethers.utils.hexZeroPad(owner.address, 32), // to multiple addresses
          ethers.utils.hexZeroPad(addr1.address, 32),
          ethers.utils.hexZeroPad(addr2.address, 32),
        ],
      ],
      fromBlock: 0,
    };

    let log = await ethers.provider.getLogs(filter);

    // not indexed param
    let value = ethers.utils.defaultAbiCoder.decode(["uint256"], log[0].data);

    let from = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      log[0].topics[1]
    );

    let to = ethers.utils.defaultAbiCoder.decode(["address"], log[0].topics[2]);
  });

  it("Propose Event has right data", async function () {
    let filter: Filter = {
      address: governorContract.address,
      topics: [
        // keccak hash of the event == topics[0]
        ethers.utils.id(
          "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)"
        ),
      ],
      fromBlock: 0,
    };

    let log = await ethers.provider.getLogs(filter);

    // no indexed params in proposal

    let data = ethers.utils.defaultAbiCoder.decode(
      [
        "uint256",
        "address",
        "address[]",
        "uint256[]",
        "string[]",
        "bytes[]",
        "uint256",
        "uint256",
        "string",
      ],
      log[0].data
    );
    let proposalId = data[0];
    let proposer = data[1];
    let targets = data[2]; // array of target contracts
    let values = data[3]; // ETH values to send mapped to contracts
    let signatures = data[4]; // array
    let calldatas = data[5]; // calldata mapped to contracts (encodedFunctionCall)
    let startBlock = data[6]; // start block of the voting
    let endBlock = data[7]; // end block of the voting
    let description = data[8]; // Description of the proposal (as hash on chain)

    expect(proposalId).to.be.equal(ethers.BigNumber.from(proposals[0]));
    expect(proposer).to.be.equal(addr1.address);
    expect(targets[0]).to.be.equal(icoManagerAddress);
    expect(values[0]).to.be.equal(ethers.BigNumber.from(0));
    expect(signatures[0]).to.be.equal("");
    expect(startBlock).to.be.equal(ethers.BigNumber.from(19));
    expect(endBlock).to.be.equal(ethers.BigNumber.from(24));
    expect(description).to.be.equal(PROPOSAL_DESCRIPTION);
  });

  it("Addr2 votes for (3%)", async function () {
    // Move to vote starting block
    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    let proposalId = proposals[0]; // target proposal to vote on

    // 0 = Againts, 1 = For, 2 = Abstain
    let voteWay = 1;
    let reason = "";

    await governorContract
      .connect(addr2)
      .castVoteWithReason(proposalId, voteWay, reason);
  });

  it("No quorum -> defeated", async function () {
    // mine blocks to reach end of 5 block voting limit
    for (let i = 0; i < VOTING_PERIOD; i++) {
      network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }

    expect(await governorContract.state(proposals[0])).to.equal(3);
  });

  it("Addr2 proposes again", async function () {
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );
    PROPOSAL_DESCRIPTION = "Second try";

    const proposeTx = await governorContract.connect(addr1).propose(
      [icoManagerContract.address], // Target addresses
      [0], // ETH to send, mapped to addresses
      [encodedFunctionCall], // mapped to addresses
      PROPOSAL_DESCRIPTION
    );

    const proposeReceipt = await proposeTx.wait(1);
    const proposalId = proposeReceipt.events[0].args.proposalId;
    proposals.push(proposalId.toString());
  });

  it("60-37% against", async function () {
    // Move into vote starting block
    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    let proposalId = proposals[1]; // target proposal to vote on

    // 0 = Againts, 1 = For, 2 = Abstain
    let voteWay = 1;
    let reason = "";

    await governorContract
      .connect(addr1)
      .castVoteWithReason(proposalId, voteWay, reason);

    voteWay = 0;
    reason = "";
    await governorContract
      .connect(owner)
      .castVoteWithReason(proposalId, voteWay, reason);
  });

  it("Snapshot before vote ends", async function () {
    let [againstVotes, forVotes, abstainVotes] =
      await governorContract.proposalVotes(proposals[1]);

    expect(againstVotes).to.be.equal(oneToken.mul(60));
    expect(forVotes).to.be.equal(oneToken.mul(37));
    expect(abstainVotes).to.be.equal(oneToken.mul(0));
  });

  it("Against wins with quorum", async function () {
    // Move after vote ends
    for (let i = 0; i < VOTING_PERIOD; i++) {
      network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }

    // Defeated with quorum
    expect(await governorContract.state(proposals[1])).to.equal(3);
  });

  it("Proposal: Mint ICOT for Manager, and start with params", async function () {
    const encodedFunctionCallMint = icotContract.interface.encodeFunctionData(
      FUNC_MINT,
      VALUES_MINT
    );
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );
    PROPOSAL_DESCRIPTION = "Third try incl minting of ICOT for ICO Manager";

    const proposeTx = await governorContract.connect(addr1).propose(
      [icotContract.address, icoManagerContract.address], // Target addresses
      [0, 0], // ETH to send, mapped to addresses
      [encodedFunctionCallMint, encodedFunctionCall], // mapped to addresses
      PROPOSAL_DESCRIPTION
    );

    const proposeReceipt = await proposeTx.wait(1);
    const proposalId = proposeReceipt.events[0].args.proposalId;
    proposals.push(proposalId.toString());
  });

  it("0-37% against, owner abstains", async function () {
    // Move into vote starting block
    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    let proposalId = proposals[2]; // target proposal to vote on

    // 0 = Againts, 1 = For, 2 = Abstain
    let voteWay = 1;
    let reason = "";

    await governorContract
      .connect(addr1)
      .castVoteWithReason(proposalId, voteWay, reason);

    voteWay = 2;
    reason = "";
    await governorContract
      .connect(owner)
      .castVoteWithReason(proposalId, voteWay, reason);
  });

  it("For wins", async function () {
    // Move after vote ends
    for (let i = 0; i < VOTING_PERIOD; i++) {
      network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }

    // Defeated with quorum
    expect(await governorContract.state(proposals[2])).to.equal(4);
  });

  it("Queue proposal", async function () {
    // Same params as propose
    const encodedFunctionCallMint = icotContract.interface.encodeFunctionData(
      FUNC_MINT,
      VALUES_MINT
    );
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    // Contract stores only hash on chain
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    // after queue, timelock will wait 1h
    const queueTx = await governorContract.queue(
      [icotContract.address, icoManagerContract.address], // Target addresses
      [0, 0], // ETH to send, mapped to addresses
      [encodedFunctionCallMint, encodedFunctionCall], // mapped to addresses
      descriptionHash
    );

    // Queued
    expect(await governorContract.state(proposals[2])).to.equal(5);
  });

  it("Execute proposal", async function () {
    // 1h delay in Timelock
    await network.provider.send("evm_increaseTime", [MIN_DELAY + 1]);

    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    // Proposal params
    const encodedFunctionCallMint = icotContract.interface.encodeFunctionData(
      FUNC_MINT,
      VALUES_MINT
    );
    const encodedFunctionCall = icoManagerContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    const executeTx = await governorContract.execute(
      [icotContract.address, icoManagerContract.address], // Target addresses
      [0, 0], // ETH to send, mapped to addresses
      [encodedFunctionCallMint, encodedFunctionCall], // mapped to addresses
      descriptionHash
    );
    await executeTx.wait(1);

    // Proposal executed
    expect(await governorContract.state(proposals[2])).to.equal(7);
  });

  it("ICO Manager has right params and has started", async function () {
    expect(await icoManagerContract.exchangeRate()).to.equal(exchangeRateBig);
    expect(await icoManagerContract.minFunding()).to.equal(minFundingBig);
    expect(await icoManagerContract.maxFunding()).to.equal(maxFundingBig);
    expect(await icoManagerContract.allocationToInvestors()).to.equal(
      allocationToInvestorsBig
    );
    expect(await icoManagerContract.stablecoinAddress(daiAddress)).to.equal(
        true
      );
  });
});
