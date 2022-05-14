/* eslint-disable */

// Heavy stress test: there are ~1000 different participants
// in the ICO with 4 leading stablecoins
// The transaction runs out of gas; 
// Consider allowing the participant to withdraw by himself

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, ContractFactory, Signer, Wallet } from "ethers";

describe("Very Successful ICO", function () {
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    other: SignerWithAddress[];

  let thousandParticipants: Wallet[] = [];

  // ICOT Token params
  let tokenName: String = "ICO Token";
  let tokenSymbol: String = "ICOT";

  // ICO Manager params
  let exchangeRate: number = 4; // $4 for every ICOT token
  let stableCoinAddress: String;
  let maxFunding: number = 4000; // $4000 max funding of the 1. ICO
  let minFunding: number = 120; // $3000 min funding
  let allocationToInvestors = 1; // max 100% to be allocated to investors
  let immediateTransferRate = 0.2; // 20% send immediately to owner upon successful ICO
  let timeDuration = 100000; // ICO duration in seconds

  // Prepare numbers
  let exchangeRateBig = ethers.utils.parseEther(exchangeRate.toString());
  let maxFundingBig = ethers.utils.parseEther(maxFunding.toString());
  let minFundingBig = ethers.utils.parseEther(minFunding.toString());
  let allocationToInvestorsBig = ethers.utils.parseEther(
    allocationToInvestors.toString()
  );
  let immediateTransferRateBig = ethers.utils.parseEther(
    immediateTransferRate.toString()
  );

  // Contract Factory Definitions
  let Dai: ContractFactory;
  let daiContract: Contract;
  let daiAddress: String;

  let Ust: ContractFactory;
  let ustContract: Contract;
  let ustAddress: String;

  let Usdt: ContractFactory;
  let usdtContract: Contract;
  let usdtAddress: String;

  let Mim: ContractFactory;
  let mimContract: Contract;
  let mimAddress: String;

  let Icot: ContractFactory;
  let icotContract: Contract;
  let icotAddress: String;

  let icoManager: ContractFactory;
  let icoManagerContract: Contract;
  let icoManagerAddress: String;

  // Utils
  let oneToken = ethers.utils.parseEther("1");
  let oneICOTPrice = ethers.utils.parseEther(exchangeRate.toString());
  let maxICOTokens = ethers.utils.parseEther("1000");
  let participantsPerStablecoin = 250;

  // Sequential testing, after this block EVM state will change
  before(async function () {
    [owner, addr1, addr2, addr3, ...other] = await ethers.getSigners();

    for (let i = 0; i < 1000; i++) {
      let wallet = ethers.Wallet.createRandom();
      wallet = wallet.connect(ethers.provider);
      thousandParticipants.push(wallet);
    }

    // Stablecoins
    Dai = await ethers.getContractFactory("DAI");
    daiContract = await Dai.deploy();
    daiAddress = daiContract.address;

    Ust = await ethers.getContractFactory("UST");
    ustContract = await Ust.deploy();
    ustAddress = ustContract.address;

    Usdt = await ethers.getContractFactory("USDT");
    usdtContract = await Usdt.deploy();
    usdtAddress = usdtContract.address;

    Mim = await ethers.getContractFactory("MIM");
    mimContract = await Mim.deploy();
    mimAddress = mimContract.address;

    // ICO Addresses
    Icot = await ethers.getContractFactory("ICOT");
    icotContract = await Icot.deploy(tokenName, tokenSymbol);
    icotAddress = icotContract.address;

    icoManager = await ethers.getContractFactory("ICOManager");
    icoManagerContract = await icoManager.deploy(
      icotAddress,
      immediateTransferRateBig
    );
    icoManagerAddress = icoManagerContract.address;
  });

  it("Owner mints 1000 ICOT and gives them to ICOManager", async function () {
    await icotContract.mint(icoManagerAddress, maxICOTokens);

    expect(await icotContract.balanceOf(icoManagerAddress)).to.equal(
      maxICOTokens
    );
  });

  it("Owner can set ICO params, allow DAI/UST/USDT/MIM", async function () {
    await icoManagerContract.setICOParameters(
      exchangeRateBig,
      [daiAddress, ustAddress, usdtAddress, mimAddress],
      minFundingBig,
      timeDuration,
      maxFundingBig,
      allocationToInvestorsBig
    );
  });

  it("250 Participants receive 4 DAI airdrop each", async function () {
    for (let i = 0*participantsPerStablecoin; i < 1*participantsPerStablecoin; i++) {
      await daiContract.mint(thousandParticipants[i].address, oneICOTPrice);
      expect(
        await daiContract.balanceOf(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants allow ICO Manager to spend 4 DAI", async function () {
    for (let i = 0*participantsPerStablecoin; i < 1*participantsPerStablecoin; i++) {
      // Give ETH to fund transactions
      await ethers.provider.send("hardhat_setBalance", [
        thousandParticipants[i].address,
        oneICOTPrice.toHexString().replace(/0x0+/, "0x"),
      ]);
      expect(
        await ethers.provider.getBalance(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);

      // Allow ICO Manager to spend 1 DAI on behalf of user
      await daiContract
        .connect(thousandParticipants[i])
        .approve(icoManagerAddress, oneICOTPrice);
      expect(
        await daiContract.allowance(
          thousandParticipants[i].address,
          icoManagerAddress
        )
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants buy each 1 ICOT for 4 DAI", async function () {
    for (let i = 0*participantsPerStablecoin; i < 1*participantsPerStablecoin; i++) {
      await icoManagerContract
        .connect(thousandParticipants[i])
        .participate(oneToken, daiAddress);
      expect(
        await icoManagerContract.investorsAmounts(
          thousandParticipants[i].address
        )
      ).to.equal(oneToken);
      expect(await icoManagerContract.investorsAddresses(i)).to.equal(
        thousandParticipants[i].address
      );
    }
  });

  it("250 Participants receive 4 UST airdrop each", async function () {
    for (let i = 1*participantsPerStablecoin; i < 2*participantsPerStablecoin; i++) {
      await ustContract.mint(thousandParticipants[i].address, oneICOTPrice);
      expect(
        await ustContract.balanceOf(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants allow ICO Manager to spend 4 UST", async function () {
    for (let i = 1*participantsPerStablecoin; i < 2*participantsPerStablecoin; i++) {
      // Give ETH to fund transactions
      await ethers.provider.send("hardhat_setBalance", [
        thousandParticipants[i].address,
        oneICOTPrice.toHexString().replace(/0x0+/, "0x"),
      ]);
      expect(
        await ethers.provider.getBalance(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);

      // Allow ICO Manager to spend 1 UST on behalf of user
      await ustContract
        .connect(thousandParticipants[i])
        .approve(icoManagerAddress, oneICOTPrice);
      expect(
        await ustContract.allowance(
          thousandParticipants[i].address,
          icoManagerAddress
        )
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants buy each 1 ICOT for 4 UST", async function () {
    for (let i = 1*participantsPerStablecoin; i < 2*participantsPerStablecoin; i++) {
      await icoManagerContract
        .connect(thousandParticipants[i])
        .participate(oneToken, ustAddress);
      expect(
        await icoManagerContract.investorsAmounts(
          thousandParticipants[i].address
        )
      ).to.equal(oneToken);
      expect(await icoManagerContract.investorsAddresses(i)).to.equal(
        thousandParticipants[i].address
      );
    }
  });

  it("250 Participants receive 4 USDT airdrop each", async function () {
    for (let i = 2*participantsPerStablecoin; i < 3*participantsPerStablecoin; i++) {
      await usdtContract.mint(thousandParticipants[i].address, oneICOTPrice);
      expect(
        await usdtContract.balanceOf(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants allow ICO Manager to spend 4 USDT", async function () {
    for (let i = 2*participantsPerStablecoin; i < 3*participantsPerStablecoin; i++) {
      // Give ETH to fund transactions
      await ethers.provider.send("hardhat_setBalance", [
        thousandParticipants[i].address,
        oneICOTPrice.toHexString().replace(/0x0+/, "0x"),
      ]);
      expect(
        await ethers.provider.getBalance(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);

      // Allow ICO Manager to spend 1 USDT on behalf of user
      await usdtContract
        .connect(thousandParticipants[i])
        .approve(icoManagerAddress, oneICOTPrice);
      expect(
        await usdtContract.allowance(
          thousandParticipants[i].address,
          icoManagerAddress
        )
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants buy each 1 ICOT for 4 USDT", async function () {
    for (let i = 2*participantsPerStablecoin; i < 3*participantsPerStablecoin; i++) {
      await icoManagerContract
        .connect(thousandParticipants[i])
        .participate(oneToken, usdtAddress);

      expect(
        await icoManagerContract.investorsAmounts(
          thousandParticipants[i].address
        )
      ).to.equal(oneToken);

      expect(await icoManagerContract.investorsAddresses(i)).to.equal(
        thousandParticipants[i].address
      );
    }
  });

  it("250 Participants receive 4 MIM airdrop each", async function () {
    for (let i = 3*participantsPerStablecoin; i < 4*participantsPerStablecoin; i++) {
      await mimContract.mint(thousandParticipants[i].address, oneICOTPrice);
      expect(
        await mimContract.balanceOf(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants allow ICO Manager to spend 4 MIM", async function () {
    for (let i = 3*participantsPerStablecoin; i < 4*participantsPerStablecoin; i++) {
      // Give ETH to fund transactions
      await ethers.provider.send("hardhat_setBalance", [
        thousandParticipants[i].address,
        oneICOTPrice.toHexString().replace(/0x0+/, "0x"),
      ]);
      expect(
        await ethers.provider.getBalance(thousandParticipants[i].address)
      ).to.equal(oneICOTPrice);

      // Allow ICO Manager to spend 1 MIM on behalf of user
      await mimContract
        .connect(thousandParticipants[i])
        .approve(icoManagerAddress, oneICOTPrice);
      expect(
        await mimContract.allowance(
          thousandParticipants[i].address,
          icoManagerAddress
        )
      ).to.equal(oneICOTPrice);
    }
  });

  it("250 Participants buy each 1 ICOT for 4 MIM", async function () {
    for (let i = 3*participantsPerStablecoin; i < 4*participantsPerStablecoin; i++) {
      await icoManagerContract
        .connect(thousandParticipants[i])
        .participate(oneToken, mimAddress);
      expect(
        await icoManagerContract.investorsAmounts(
          thousandParticipants[i].address
        )
      ).to.equal(oneToken);
      expect(await icoManagerContract.investorsAddresses(i)).to.equal(
        thousandParticipants[i].address
      );
    }
  });

  it("All investors have correct parameters in ICO Manager", async function () {
    for (let i = 0; i < 4*participantsPerStablecoin; i++) {
      expect(
        await icoManagerContract.investorsAmounts(
          thousandParticipants[i].address
        )
      ).to.equal(oneToken);

      expect(await icoManagerContract.investorsAddresses(i)).to.equal(
        thousandParticipants[i].address
      );
    }
  });

  it("Sets network timestamp to when ICO has ended", async function () {
    await ethers.provider.send("evm_increaseTime", [timeDuration]);
    await icoManagerContract.checkTimeLimit();
  });

  it("Investors receive tokens", async function () {
    for (let i = 0; i < 4*participantsPerStablecoin; i++) {
      expect(
        await icotContract.balanceOf(thousandParticipants[i].address)
      ).to.equal(oneToken);
    }
  });
});
