/* eslint-disable */
import hre from "hardhat";
import { readFileSync } from "fs";
import { MIN_DELAY } from "./params";

async function main() {
  const rawData = readFileSync("./scripts/contract-address.json", "utf8");
  const jsonData = JSON.parse(rawData);

  const timelockAddress = jsonData.timelock;

  // Verify contract source code
  await hre.run("verify:verify", {
    address: timelockAddress,
    constructorArguments: [MIN_DELAY, [], []],
    contract: "contracts/dao/Timelock.sol:Timelock",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
