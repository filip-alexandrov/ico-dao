/* eslint-disable */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber, Contract, ContractFactory, Signer, Wallet } from "ethers";
import { encode } from "punycode";
import { Filter } from "ethers/node_modules/@ethersproject/providers";

class Calldata {
  FUNC_MINT: String = "";
  VALUES_MINT: any[] = [];

  FUNC: String = "";
  VALUES: any[] = [];
  PROPOSAL_DESCRIPTION: String = "";

  constructor(
    icoManagerAddress: String,
    maxFundingBig: BigNumber,
    exchangeRateBig: BigNumber,
    daiAddress: String,
    minFundingBig: BigNumber,
    timeDuration: Number,
    allocationToInvestorsBig: BigNumber,
    proposalDescription : String
  ) {
    this.FUNC_MINT = "mint";
    this.VALUES_MINT = [icoManagerAddress, maxFundingBig];

    this.FUNC = "setICOParameters";
    this.VALUES = [
      exchangeRateBig,
      [daiAddress],
      minFundingBig,
      timeDuration,
      maxFundingBig,
      allocationToInvestorsBig,
    ];

    this.PROPOSAL_DESCRIPTION = proposalDescription;
  }
}
