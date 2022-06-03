/* eslint-disable */
import hre from "hardhat";
import * as dotenv from "dotenv";
import {
  MIN_DELAY,
  VOTING_DELAY,
  VOTING_PERIOD,
  MIN_VOTES_TO_PROPOSE,
  QUORUM_PERCENTAGE,
  ICOT_NAME,
  ICOT_SYMBOL,
  immediateTransferRateBig,
} from "./params";
import { writeFileSync } from "fs";

const ethers = hre.ethers;

async function main() {
  const ICOT = await ethers.getContractFactory("ICOT");
  const ICOTContract = await ICOT.deploy(ICOT_NAME, ICOT_SYMBOL);
  await ICOTContract.deployed();

  console.log("Voting token deployed to:", ICOTContract.address);

  const Timelock = await ethers.getContractFactory("Timelock");
  const timelockContract = await Timelock.deploy(MIN_DELAY, [], []);
  await timelockContract.deployed();

  console.log("Timelock Controller deployed to: ", timelockContract.address);

  const Governor = await ethers.getContractFactory("ICOGovenor");
  const governorContract = await Governor.deploy(
    ICOTContract.address,
    timelockContract.address,
    VOTING_DELAY,
    VOTING_PERIOD,
    MIN_VOTES_TO_PROPOSE,
    QUORUM_PERCENTAGE
  );
  await governorContract.deployed();

  console.log("Governor Contract deployed to: ", governorContract.address);

  const ICOManager = await ethers.getContractFactory("ICOManager");
  const icoManagerContract = await ICOManager.deploy(
    ICOTContract.address,
    immediateTransferRateBig
  );
  await icoManagerContract.deployed();

  console.log("ICOManager Contract deployed to: ", icoManagerContract.address);

  const addressData = {
    icoToken: ICOTContract.address,
    timelock: timelockContract.address,
    governor: governorContract.address,
    icoManager: icoManagerContract.address,
  };

  writeFileSync("./scripts/contract-address.json", JSON.stringify(addressData));

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

  // Mint min tokens to propose to owner 
  // and transfer ICOT ownership to timelock
  await ICOTContract.mint(process.env.PUBKEY || "", MIN_VOTES_TO_PROPOSE);
  const transferICOT = await ICOTContract.transferOwnership(timelockContract.address);
  await transferICOT.wait(1);

  // Wait 10 blocks to allow solidity code to get
  // on etherscan backend
  await governorContract.deployTransaction.wait(10);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
