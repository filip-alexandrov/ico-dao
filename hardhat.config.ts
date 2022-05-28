import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 20, // optimize code to safe upto 2x gas
      },
    },
  },
  networks: {
    kovan: {
      url: "https://kovan.infura.io/v3/b80ca1c194e74356b5926ce8f2c5a561",
      accounts: [process.env.PRIVKEY || ""],
    },
    "optimism-kovan": {
      url: "https://kovan.optimism.io",
      accounts: [process.env.PRIVKEY || ""],
    },
    rinkeby:{
      url: "https://rinkeby.infura.io/v3/b80ca1c194e74356b5926ce8f2c5a561", 
      accounts: [process.env.PRIVKEY || ""],
    },
    mainnet:{
      url: "https://mainnet.infura.io/v3/b80ca1c194e74356b5926ce8f2c5a561", 
      accounts: [process.env.PRIVKEY || ""],
    }
    
    
  },
  gasReporter: {
    enabled: false, // enable for detailed gas report
    currency: "USD",
    // gasPrice: 45,
    token: "ETH",
    coinmarketcap: "5a4f55b1-966b-4dcf-8100-7253ee0b2301", // api to get eth price
  },
  etherscan: {
    apiKey: {
      mainnet: "QNHRRBU79TSRAKWN2NBP78HZYY2XCJBFSU", // api to get gas price / verify
      optimisticKovan: "BX38I5HEZGG7UMJ87Q7PYIT9BKM5SGWKAA",
      kovan: "QNHRRBU79TSRAKWN2NBP78HZYY2XCJBFSU",
      rinkeby: "QNHRRBU79TSRAKWN2NBP78HZYY2XCJBFSU",
    },
  },
  mocha: {
    timeout: 600000, // Chai timeout 10min, to satisfy stress testing
  },
  contractSizer: {
    strict: false, // error if exceeds 24kb limit
    runOnCompile: false,
  },
};

export default config;
