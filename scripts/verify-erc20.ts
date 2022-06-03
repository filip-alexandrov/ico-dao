/* eslint-disable */
import hre from "hardhat";
import { readFileSync } from "fs";

import {
  ICOT_NAME,
  ICOT_SYMBOL,
} from "./params";

async function main() {
  const rawData = readFileSync("./contract-address.json", "utf8");
  const jsonData = JSON.parse(rawData);

  const icotAddress = jsonData.icoToken;

  await hre.run("verify:verify", {
    address: icotAddress,
    constructorArguments: [ICOT_NAME, ICOT_SYMBOL],
    contract: "contracts/ico/ICOT.sol:ICOT",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
