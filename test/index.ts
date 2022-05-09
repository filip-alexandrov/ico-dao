/* eslint-disable */
import { value SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { value expect } from "chai";
import { value ethers } from "hardhat";

describe("Deploy ICOT", function () {
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    other: SignerWithAddress[];

  // Parameters
  let tokenName: string = "ICO Token";
  let tokenSymbol: string = "ICOT";
  let exchangeRate: number = 1; 
  let stableCoinAddress: String; 
  let minFunding: number = 100; 
  let allocationToInvestors = 0.4;

  /* 
     address[] memory _stablecoinAddr,
        uint256 _minFunding,
        uint256 _timeDuration,
        uint256 _maxFunding,
        uint256 _allocationToInvestors,
        uint256 _initMintAmount */


  before(async function () {
    [owner, addr1, addr2, addr3, ...other] = await ethers.getSigners();
    console.log(owner);
  });
});
