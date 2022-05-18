import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer"

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
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: false, // enable for detailed gas report
    currency: "USD",
    // gasPrice: 45,
    token: "ETH",
    coinmarketcap: "5a4f55b1-966b-4dcf-8100-7253ee0b2301", // api to get eth price
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, // api to get gas price
  },
  mocha: {
    timeout: 600000, // Timeout 10min
  },
  contractSizer: {
    strict: false, // error if exceeds 24kb limit
    runOnCompile: false,
  }
};

export default config;
