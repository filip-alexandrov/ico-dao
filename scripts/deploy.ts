// timelock 0x7Fa7eC42546072Ad1ae3FF993801fe9890cC33C9
// votingToken 0x70eACA707914549951cE39e816BF27954fB067d4
// GovernorContract 0x6AcEe6D5332e7Ac67086Ca76e04BE5a429Ed87e3

import hre from "hardhat";
const ethers = hre.ethers;

async function main() {
 /*  const VotingToken = await ethers.getContractFactory("VotingToken");
  const votingContract = await VotingToken.deploy();
  await votingContract.deployed();

  console.log("Voting token deployed to:", votingContract.address);

  const MIN_DELAY = 300; // secs to delay execution
  const Timelock = await ethers.getContractFactory("Timelock");
  const timelockContract = await Timelock.deploy(MIN_DELAY, [], []);
  await timelockContract.deployed();

  console.log("Timelock Controller deployed to: ", timelockContract.address);

  const voteTokenAddress = votingContract.address;
  const timelockAddress = timelockContract.address;
  const VOTING_DELAY = 2; // blocks delay before voting starts
  const VOTING_PERIOD = 5; // blocks voting duration
  const MIN_VOTES_TO_PROPOSE = 10; // tokens
  const QUORUM_PERCENTAGE = 51; // min 50% have to vote

  const Governor = await ethers.getContractFactory("ICOGovenor");
  const governorContract = await Governor.deploy(
    voteTokenAddress,
    timelockAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    MIN_VOTES_TO_PROPOSE,
    QUORUM_PERCENTAGE
  );
  await governorContract.deployed();

  console.log("Governor Contract deployed to: ", governorContract.address);

  // Wait 10 blocks to allow solidity code to get
  // on etherscan backend
  await governorContract.deployTransaction.wait(10); 


  // Verify contract source code
  await hre.run("verify:verify", {
    address: "0x76Fe17508A2ecaA198a9B52f5Aad6d4A7a3a549A",
    constructorArguments: [MIN_DELAY, [], []],
    contract: "contracts/dao/Timelock.sol:Timelock",
  });
  

  await hre.run("verify:verify", {
    address:"0x7A2bcC2fE5c7c97B9c95cD77c2eC96b6a2420E2F",
    constructorArguments: [],
    contract: "contracts/dao/ERC20Votes.sol:VotingToken",
  });
 */ 

  const voteTokenAddress = "0x7A2bcC2fE5c7c97B9c95cD77c2eC96b6a2420E2F";
  const timelockAddress = "0x76Fe17508A2ecaA198a9B52f5Aad6d4A7a3a549A";
  const VOTING_DELAY = 2; // blocks delay before voting starts
  const VOTING_PERIOD = 5; // blocks voting duration
  const MIN_VOTES_TO_PROPOSE = 10; // tokens
  const QUORUM_PERCENTAGE = 51; // min 50% have to vote

  await hre.run("verify:verify", {
    address: "0x278Dfd116Ac51449459a96b3412F058582CafE8F",
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
