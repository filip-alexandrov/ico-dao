/* eslint-disable */
import hre from "hardhat";
import {
  MIN_DELAY,
  VOTING_DELAY,
  VOTING_PERIOD,
  MIN_VOTES_TO_PROPOSE,
  QUORUM_PERCENTAGE,
} from "./params";
import { writeFileSync } from "fs";

const ethers = hre.ethers;

async function main() {
  const VotingToken = await ethers.getContractFactory("VotingToken");
  const votingContract = await VotingToken.deploy();
  await votingContract.deployed();

  console.log("Voting token deployed to:", votingContract.address);

  const Timelock = await ethers.getContractFactory("Timelock");
  const timelockContract = await Timelock.deploy(MIN_DELAY, [], []);
  await timelockContract.deployed();

  console.log("Timelock Controller deployed to: ", timelockContract.address);

  const Governor = await ethers.getContractFactory("ICOGovenor");
  const governorContract = await Governor.deploy(
    votingContract.address,
    timelockContract.address,
    VOTING_DELAY,
    VOTING_PERIOD,
    MIN_VOTES_TO_PROPOSE,
    QUORUM_PERCENTAGE
  );
  await governorContract.deployed();

  console.log("Governor Contract deployed to: ", governorContract.address);

  const addressData = {
    votingToken: votingContract.address,
    timelock: timelockContract.address,
    governor: governorContract.address,
  };

  writeFileSync("./scripts/contract-address.json", JSON.stringify(addressData));

  // Wait 10 blocks to allow solidity code to get
  // on etherscan backend
  await governorContract.deployTransaction.wait(10);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
