/* eslint-disable */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Contract, ContractFactory, Signer, Wallet } from "ethers";
import { encode } from "punycode";

describe("DAO integration with ICO Token", function () {
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
  let MIN_VOTES_TO_PROPOSE = 0; // min tokens to propose

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
  });

  it("Owner self delegates 1 tokens", async function () {
    // Delegate should be called once only to activate
    // voting functionality; thereafter- auto checkpoints

    await icotContract.mint(owner.address, oneToken);

    const tx = await icotContract.delegate(owner.address);
    await tx.wait(1);
    expect(await icotContract.numCheckpoints(owner.address)).to.equal(1);
  });

  it("Addr1 receives and self delegates 2 tokens", async function () {
    await icotContract.mint(addr1.address, oneToken.mul(2));

    const tx = await icotContract.delegate(addr1.address);
    await tx.wait(1);
    expect(await icotContract.numCheckpoints(addr1.address)).to.equal(1);
  });

  it("Transfers ownership of ICOT to DAO", async function () {
    await icotContract.transferOwnership(timelockAddress);

    const owner = await icotContract.owner();
    expect(owner).to.equal(timelockAddress);
  });

  it("Addr1 proposes minting himself 1 more Tokens", async function () {
    // encode bytes calldata; function to call
    let FUNC = "mint";
    let VALUES = [addr1.address, oneToken];

    const encodedFunctionCall = icotContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    // to decode:
    // console.log(boxContract.interface.decodeFunctionData("store",encodedFunctionCall))

    let PROPOSAL_DESCRIPTION = "Mint myself (addr1) 1 aditional ICOT";

    const proposeTx = await governorContract.connect(addr1).propose(
      [icotAddress], // Target addresses
      [0], // ETH to send, mapped to addresses
      [encodedFunctionCall], // mapped to addresses
      PROPOSAL_DESCRIPTION
    );
    const proposeReceipt = await proposeTx.wait(1);

    // Next block, voting starts
    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    // Get proposal ÍD
    const proposalId = proposeReceipt.events[0].args.proposalId;
    proposals.push(proposalId.toString());
  });

  it("Owner and Addr1 vote", async function () {
    let proposalId = proposals[0]; // target proposal to vote on

    // 0 = Againts, 1 = For, 2 = Abstain
    let voteWay = 1;
    let reason = "I, Addr1 like my proposal and vote with 2 Votes";

    let voteTxResponse = await governorContract
      .connect(addr1)
      .castVoteWithReason(proposalId, voteWay, reason);
    await voteTxResponse.wait(1);

    // Owner votes against
    voteWay = 0;
    reason = "I, the former owner, don't want addr1 minting more for himself";

    voteTxResponse = await governorContract
      .connect(owner)
      .castVoteWithReason(proposalId, voteWay, reason);
    await voteTxResponse.wait(1);
  });

  it("Moves chain block number", async function () {
    // Move chain to end block of voting
    for (let i = 0; i < VOTING_PERIOD; i++) {
      network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }
  });

  it("Proposal success, 2-1 in favour", async function () {
    // Proposal state: Pending, Active, Canceled, Defeated,
    // Succeeded, Queued, Expired, Executed

    expect(await governorContract.state(proposals[0])).to.equal(4);
  });

  it("Queue proposal", async function () {
    // Same params as propose
    let FUNC = "mint";
    let VALUES = [addr1.address, oneToken];
    let PROPOSAL_DESCRIPTION = "Mint myself (addr1) 1 aditional ICOT";

    const encodedFunctionCall = icotContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    // Contract stores only hash on chain
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    // after queue, timelock will wait 1h
    const queueTx = await governorContract.queue(
      [icotAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await queueTx.wait(1);

    // Queued
    expect(await governorContract.state(proposals[0])).to.equal(5);
  });

  it("Jump to timestamp after queue (1h)", async function () {
    await network.provider.send("evm_increaseTime", [MIN_DELAY + 1]);

    network.provider.request({
      method: "evm_mine",
      params: [],
    });
  });

  it("Executes proposal", async function () {
    // Same params as propose
    let FUNC = "mint";
    let VALUES = [addr1.address, oneToken];
    let PROPOSAL_DESCRIPTION = "Mint myself (addr1) 1 aditional ICOT";

    const encodedFunctionCall = icotContract.interface.encodeFunctionData(
      FUNC,
      VALUES
    );

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );
    

    const executeTx = await governorContract.execute(
      [icotAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await executeTx.wait(1);

    // Proposal executed
    expect(await governorContract.state(proposals[0])).to.equal(7);
  });

  it("Addr1 has received 1 more token", async function () {
    expect(await icotContract.balanceOf(addr1.address)).to.equal(oneToken.mul(3));
  });
});
