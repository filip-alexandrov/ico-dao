import hre from "hardhat";
import { readFileSync } from "fs";

async function main() {
  const rawData = readFileSync("./contract-address.json", "utf8");
  const jsonData = JSON.parse(rawData);

  const voteTokenAddress = jsonData.votingToken;

  await hre.run("verify:verify", {
    address: voteTokenAddress,
    constructorArguments: [],
    contract: "contracts/dao/ERC20Votes.sol:VotingToken",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
