/* eslint-disable */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Contract, ContractFactory, Signer, Wallet } from "ethers";
import { encode } from "punycode";

describe.only("DAO functionality test", function () {
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    other: SignerWithAddress[];

  let delayBeforeVotingStarts = 1; /* in blocks */
  let votingDurationInBlocks = 45818; /* 1 week in blocks */
  let minTokensToCreate = 0; /* min token balance to propose */

  // Contract Factory Definitions
  let Erc20Votes: ContractFactory;
  let votesContract: Contract;
  let voteTokenAddress: String;

  let Governor: ContractFactory;
  let governorContract: Contract;
  let governorAddress: String;

  let Timelock: ContractFactory;
  let timelockContract: Contract;
  let timelockAddress: String;

  let Box: ContractFactory;
  let boxContract: Contract;
  let boxAddress: String;

  // Utils
  let oneToken = ethers.utils.parseEther("1");
  let proposals: string[] = [];

  // Constants
  let MIN_DELAY = 3600; // after successful vote, queue execution
  let VOTING_PERIOD = 5; // #blocks
  let QUORUM_PERCENTAGE = 4;
  let VOTING_DELAY = 1; // 1 block till proposal voting begins
  let MIN_VOTES_TO_PROPOSE = 0;

  let FUNC = "store";
  let NEW_STORE_VALUE = 77;
  let PROPOSAL_DESCRIPTION = "Proposal #1: Store 77 in the Box";

  before(async function () {
    [owner, addr1, addr2, addr3, ...other] = await ethers.getSigners();

    Erc20Votes = await ethers.getContractFactory("VotingToken");
    votesContract = await Erc20Votes.deploy();
    voteTokenAddress = votesContract.address;

    Timelock = await ethers.getContractFactory("Timelock");
    timelockContract = await Timelock.deploy(MIN_DELAY, [], []);
    timelockAddress = timelockContract.address;

    Governor = await ethers.getContractFactory("ICOGovenor");
    governorContract = await Governor.deploy(
      voteTokenAddress,
      timelockAddress,
      VOTING_DELAY,
      VOTING_PERIOD,
      MIN_VOTES_TO_PROPOSE,
      QUORUM_PERCENTAGE
    );
    governorAddress = governorContract.address;

    // Deploy mock Box contract
    Box = await ethers.getContractFactory("Box");
    boxContract = await Box.deploy();
    boxAddress = boxContract.address;

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

    // Revoke Box ownership
    const transferOwnerTx = await boxContract.transferOwnership(
      timelockAddress
    );
    await transferOwnerTx.wait(1);
  });

  it("Owner self delegates tokens", async function () {
    // Delegate should be called once only to activate
    // voting functionality; thereafter- auto checkpoints

    await votesContract.mint(owner.address, oneToken);

    const tx = await votesContract.delegate(owner.address);
    await tx.wait(1);
    expect(await votesContract.numCheckpoints(owner.address)).to.equal(1);
  });

  it("Successful deployment", async function () {
    /* await icotContract.mint(icoManagerAddress, maxICOTokens);

    expect(await icotContract.balanceOf(icoManagerAddress)).to.equal(
      maxICOTokens
    ); */
    console.log(voteTokenAddress);
    console.log(governorAddress);
    console.log(timelockAddress);
  });

  it("Proposes", async function () {
    // encode bytes calldata; function to call
    const encodedFunctionCall = boxContract.interface.encodeFunctionData(FUNC, [
      NEW_STORE_VALUE,
    ]);

    // to decode:
    // console.log(boxContract.interface.decodeFunctionData("store",encodedFunctionCall))

    const proposeTx = await governorContract.propose(
      [boxAddress],
      [0],
      [encodedFunctionCall],
      PROPOSAL_DESCRIPTION
    );
    const proposeReceipt = await proposeTx.wait(1);

    network.provider.request({
      method: "evm_mine",
      params: [],
    });

    // Get proposal ÍD
    const proposalId = proposeReceipt.events[0].args.proposalId;
    proposals.push(proposalId.toString());
  });

  it("Votes", async function () {
    const proposalId = proposals[0];

    // 0 = Againts, 1 = For, 2 = Abstain
    const voteWay = 1;
    const reason = "Yes I like it";

    const voteTxResponse = await governorContract.castVoteWithReason(
      proposalId,
      voteWay,
      reason
    );
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

  it("Proposal success", async function () {
    // Proposal state Pending, Active, Canceled, Defeated,
    // Succeeded, Queued, Expired, Executed

    expect(await governorContract.state(proposals[0])).to.equal(4);
  });

  it("Queue proposal", async function () {
    // Same params as propose
    const encodedFunctionCall = boxContract.interface.encodeFunctionData(FUNC, [
      NEW_STORE_VALUE,
    ]);

    // Contract stores only hash on chain
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    // 0 = value of ETH to be sent
    const queueTx = await governorContract.queue(
      [boxAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await queueTx.wait(1);

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
    const encodedFunctionCall = boxContract.interface.encodeFunctionData(FUNC, [
      NEW_STORE_VALUE,
    ]);
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION)
    );

    const executeTx = await governorContract.execute(
      [boxAddress],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await executeTx.wait(1);

    expect(await governorContract.state(proposals[0])).to.equal(7);
  });
  
  it("Box has new value", async function () {
    expect(await boxContract.retrieve()).to.equal(NEW_STORE_VALUE);
  });
});
