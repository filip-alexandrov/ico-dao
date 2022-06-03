/* eslint-disable */
import hre from "hardhat";
import { readFileSync } from "fs";
import { immediateTransferRateBig } from "./params";

async function main() {
  const rawData = readFileSync("./scripts/contract-address.json", "utf8");
  const jsonData = JSON.parse(rawData);

  const icoManagerAddress = jsonData.icoManager;
  const icoTokenAddress = jsonData.icoToken;



  // Verify contract source code
  await hre.run("verify:verify", {
    address: icoManagerAddress,
    constructorArguments: [icoTokenAddress, immediateTransferRateBig],
    contract: "contracts/ico/ICOManager.sol:ICOManager",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
