/* eslint-disable */
import hre from "hardhat";
import { readFileSync } from "fs";
import {
  VOTING_DELAY,
  VOTING_PERIOD,
  MIN_VOTES_TO_PROPOSE,
  QUORUM_PERCENTAGE,
} from "./params";

async function main() {
  const rawData = readFileSync("./scripts/contract-address.json", "utf8");
  const jsonData = JSON.parse(rawData);

  const governorAddress = jsonData.governor;
  const voteTokenAddress = jsonData.votingToken;
  const timelockAddress = jsonData.timelock;

  await hre.run("verify:verify", {
    address: governorAddress,
    constructorArguments: [
      voteTokenAddress,
      timelockAddress,
      VOTING_DELAY,
      VOTING_PERIOD,
      MIN_VOTES_TO_PROPOSE,
      QUORUM_PERCENTAGE,
    ],
    contract: "contracts/dao/Govenor.sol:ICOGovenor",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
