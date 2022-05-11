/* eslint-disable */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, ContractFactory } from "ethers";

describe("Successful ICO", function () {
  let owner: SignerWithAddress,
    addr1: SignerWithAddress,
    addr2: SignerWithAddress,
    addr3: SignerWithAddress,
    other: SignerWithAddress[];

  // ICOT Token params
  let tokenName: String = "ICO Token";
  let tokenSymbol: String = "ICOT";

  // ICO Manager params
  let exchangeRate: number = 4; // $4 for every ICOT token
  let stableCoinAddress: String;
  let maxFunding: number = 165; // $165 max funding of the 1. ICO
  let minFunding: number = 100;
  let allocationToInvestors = 0.4; // max 40% of tokens available in ICO Manger's vault will be ICOed
  let immediateTransferRate = 0.2; // 20% send immediately to owner upon successful ICO
  let timeDuration = 1000; // ICO duration in seconds

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

  let Icot: ContractFactory;
  let icotContract: Contract;
  let icotAddress: String;

  let icoManager: ContractFactory;
  let icoManagerContract: Contract;
  let icoManagerAddress: String;

  // Utils 
  let tokensStillAvailable:BigNumber; // Tokens available for Addr2 to buy
  let maxICOTokens:BigNumber; 
  let tokensTotalInContract:BigNumber = maxFundingBig; 

  // Sequential testing, after this block EVM state will change
  before(async function () {
    [owner, addr1, addr2, addr3, ...other] = await ethers.getSigners();

    Dai = await ethers.getContractFactory("DAI");
    daiContract = await Dai.deploy();
    daiAddress = daiContract.address;

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

  it("Should have the right owner", async function () {
    expect(await icoManagerContract.owner()).to.equal(owner.address);
  });

  it("Should have the right immediateTransfer", async function () {
    expect(await icoManagerContract.fundImmediateTransfer()).to.equal(
      immediateTransferRateBig
    );
  });

  it("Should have the right ICOT address", async function () {
    expect(await icoManagerContract.ICOTAddress()).to.equal(icotAddress);
  });

  it("Cannot start with 0 ICOT in Manager", async function () {
    await expect(
      icoManagerContract.setICOParameters(
        exchangeRateBig,
        [daiAddress],
        minFundingBig,
        timeDuration,
        maxFundingBig,
        allocationToInvestorsBig
      )
    ).to.be.revertedWith("Increase allocation To Investors");
  });

  it("Owner mints 165 ICOT and gives them to ICOManager", async function () {
    await icotContract.mint(icoManagerAddress, maxFundingBig);

    expect(await icotContract.balanceOf(icoManagerAddress)).to.equal(
      maxFundingBig
    );
  });

  it("Random address mints ICOT", async function () {
    await expect(
      icotContract.connect(addr1).mint(icoManagerAddress, maxFundingBig)
    ).to.be.revertedWith("Not the owner");
  });

  it("Addr1 and Addr2 can exchange ICOT freely", async function () {
    await icotContract.mint(addr1.address, maxFundingBig);
    await icotContract.connect(addr1).transfer(addr2.address, maxFundingBig);

    expect(await icotContract.balanceOf(addr2.address)).to.equal(maxFundingBig);

    // Burn minted ICOT in addr2 to not interfere with following test math
    await icotContract.connect(addr2).transfer(ethers.Wallet.createRandom().address, maxFundingBig);
    expect(await icotContract.balanceOf(addr2.address)).to.equal(ethers.constants.Zero);
  });

  it("Random address cannot set ico params", async function () {
    await expect(
      icoManagerContract
        .connect(addr1)
        .setICOParameters(
          exchangeRateBig,
          [daiAddress],
          minFundingBig,
          timeDuration,
          maxFundingBig,
          allocationToInvestorsBig
        )
    ).to.be.revertedWith("Not the owner");
  });

  it("Max Allocation not sufficient", async function () {
    let allocationNewBig = ethers.utils.parseEther("0.01");

    await expect(
      icoManagerContract.setICOParameters(
        exchangeRateBig,
        [daiAddress],
        minFundingBig,
        timeDuration,
        maxFundingBig,
        allocationNewBig
      )
    ).to.be.revertedWith("Increase allocation To Investors");
  });

  it("Owner can set ICO params", async function () {
    await icoManagerContract.setICOParameters(
      exchangeRateBig,
      [daiAddress],
      minFundingBig,
      timeDuration,
      maxFundingBig,
      allocationToInvestorsBig
    );
  });

  it("Has correct timeLimit", async function () {
    // Last block timestamp == timestamp in contract
    // Contract uses timestamp current
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    expect(await icoManagerContract.timeLimit()).to.equal(
      timeDuration + timestampBefore
    );
  });

  it("After start of ICO, no change allowed", async function () {
    await expect(
      icoManagerContract.setICOParameters(
        exchangeRateBig,
        [daiAddress],
        minFundingBig,
        timeDuration,
        maxFundingBig,
        allocationToInvestorsBig
      )
    ).to.be.revertedWith("ICO is already active");
  });

  it("ICO has correct params", async function () {
    expect(await icoManagerContract.exchangeRate()).to.equal(exchangeRateBig);
    expect(await icoManagerContract.minFunding()).to.equal(minFundingBig);
    expect(await icoManagerContract.maxFunding()).to.equal(maxFundingBig);
    expect(await icoManagerContract.allocationToInvestors()).to.equal(
      allocationToInvestorsBig
    );
    
    /* expect(await icoManagerContract.stablecoinAddrList(0)).to.equal(
      daiAddress
    ); */
    expect(await icoManagerContract.stablecoinAddress(daiAddress)).to.equal(
      true
    );

  });

  it("Max Tokens sellable is correct", async function () {
    // Can be different, floating point operation
    let maxTokens = parseFloat(
      ethers.utils.formatEther(await icoManagerContract.maxICOTokens())
    );
    expect(maxTokens).to.equal(maxFunding / exchangeRate);
  });

  it("Min Tokens sellable is correct", async function () {
    // Can be different, floating point operation
    let maxTokens = parseFloat(
      ethers.utils.formatEther(await icoManagerContract.minICOTokens())
    );
    expect(maxTokens).to.equal(minFunding / exchangeRate);
  });

  it("TimeLimitReached & ICOCurrent correct", async function () {
    expect(await icoManagerContract.ICOCurrent()).to.equal(
      ethers.utils.parseEther("0")
    );
    expect(await icoManagerContract.timeLimitReached()).to.equal(false);
  });
  
  it("TimeLimitReached & ICOCurrent correct", async function () {
    expect(await icoManagerContract.ICOCurrent()).to.equal(
      ethers.utils.parseEther("0")
    );
    expect(await icoManagerContract.timeLimitReached()).to.equal(false);
  });
    
  it("Addr1 cannot participate in ICO with $0", async function () {
    let dollarAmount = ethers.utils.parseEther("0")
 
    await expect(icoManagerContract.connect(addr1).participate(dollarAmount, daiAddress)).to.be.revertedWith("Amount must be greater than 0")
  });
  
  it("Cannot go over maxFunding", async function () {
    let dollarAmount = ethers.utils.parseEther("200")
 
    await expect(icoManagerContract.connect(addr1).participate(dollarAmount, daiAddress)).to.be.revertedWith("Not enough tokens available")
  });
  
  it("Cannot use not accepted stablecoin address", async function () {
    let dollarAmount = ethers.utils.parseEther("1")
 
    await expect(icoManagerContract.connect(addr1).participate(dollarAmount, addr2.address)).to.be.revertedWith("Stablecoin is not accepted")
  });
  
  it("Balance of particiant too low", async function () {
    let dollarAmount = ethers.utils.parseEther("1")
 
    await expect(icoManagerContract.connect(addr1).participate(dollarAmount, daiAddress)).to.be.revertedWith("Not enough tokens in stablecoin")
  });

  it("Addr1 receives DAI", async function () {
    await daiContract.mint(addr1.address, maxFundingBig); 
    expect(await daiContract.balanceOf(addr1.address)).to.equal(maxFundingBig);
  });
  
  it("Addr1 allows DAI spending from ICOManagers", async function () {
    let dollarAmount = ethers.utils.parseEther("4")

    await daiContract.connect(addr1).approve(icoManagerAddress, dollarAmount)
    expect(await daiContract.allowance(addr1.address, icoManagerAddress)).to.equal(dollarAmount);
  });

  it("Addr1 participate in ICO with $4 == 1 ICOT", async function () {
    let icotAmount = ethers.utils.parseEther("1")

    await icoManagerContract.connect(addr1).participate(icotAmount, daiAddress)
  });
  
  it("Addr1 cannot participate without approving ICOManager", async function () {
    let icotAmount = ethers.utils.parseEther("1")

    await expect(icoManagerContract.connect(addr1).participate(icotAmount, daiAddress)).to.be.revertedWith("ERC20: insufficient allowance")
  });
  
  it("ICO Current rises with 1 ICOT", async function () {
    let icoCurrent = ethers.utils.parseEther("1")

    expect( await icoManagerContract.ICOCurrent()).to.equal(icoCurrent)
  });
  
  it("InvestorsAmount for addr1 increases by 1 ICOT", async function () {
    let addr1Amount = ethers.utils.parseEther("1")

    expect( await icoManagerContract.investorsAmounts(addr1.address)).to.equal(addr1Amount)
  });

  it("investorsAddresses array has addr1", async function () {
    expect(await icoManagerContract.investorsAddresses(0)).to.equal(addr1.address)
  });
  
  it("investorsAddresses has only 1 address", async function () {
    await expect(icoManagerContract.investorsAddresses(1)).to.be.reverted
  });
  
  it("addr2 buys the rest of the ICOT available", async function () {
    // Mint enough DAI to buy rest of the tokens
    await daiContract.mint(addr2.address, maxFundingBig); 
    expect(await daiContract.balanceOf(addr2.address)).to.equal(maxFundingBig);

    // Approve ICOManager to spend DAI on behalf of Addr2
    await daiContract.connect(addr2).approve(icoManagerAddress, maxFundingBig)
    expect(await daiContract.allowance(addr2.address, icoManagerAddress)).to.equal(maxFundingBig);

    // buy the rest of the tokens
    maxICOTokens = await icoManagerContract.maxICOTokens()
    let ICOCurrent = await icoManagerContract.ICOCurrent()

    tokensStillAvailable = maxICOTokens.sub(ICOCurrent);
    await icoManagerContract.connect(addr2).participate(tokensStillAvailable, daiAddress)
  });
  
  it("addr1 cannot buy, all tokens sold", async function () {
    // Approve ICOManager to spend DAI on behalf of Addr1
    await daiContract.connect(addr1).approve(icoManagerAddress, maxFundingBig)
    expect(await daiContract.allowance(addr1.address, icoManagerAddress)).to.equal(maxFundingBig);

    let icotAmount = ethers.utils.parseEther("1")
    await expect(icoManagerContract.connect(addr1).participate(icotAmount, daiAddress)).to.be.revertedWith("Not enough tokens available")
  });
  
  it("Sets network timestamp to when ICO has ended", async function () {
    await ethers.provider.send("evm_increaseTime", [3600])
    await icoManagerContract.checkTimeLimit()
  });

  it("Addr1 has 1 ICOT Token", async function () {
    expect(await icotContract.balanceOf(addr1.address)).to.equal(ethers.constants.WeiPerEther);
  })
  
  it("Addr2 has the rest ICOT Token", async function () {
    expect(await icotContract.balanceOf(addr2.address)).to.equal(tokensStillAvailable);
  })
  
  it("Owner has received 20% of DAI immediately", async function () {
    let daiInOwner = (immediateTransferRate * maxFunding).toString(); 
    let daiInOwnerBig = ethers.utils.parseEther(daiInOwner)

    expect(await daiContract.balanceOf(owner.address)).to.equal(daiInOwnerBig);
  })
  
  it("Contract has received 80% of DAI immediately", async function () {
    let daiInContract = ( (1 - immediateTransferRate) * maxFunding).toString(); 
    let daiInContractBig = ethers.utils.parseEther(daiInContract)

    expect(await daiContract.balanceOf(icoManagerAddress)).to.equal(daiInContractBig);
  })
  
  it("Resets ICO parameters", async function () {
    expect(await icoManagerContract.timeLimit()).to.equal(0);
    expect(await icoManagerContract.minFunding()).to.equal(0);
    expect(await icoManagerContract.maxFunding()).to.equal(0);
    expect(await icoManagerContract.exchangeRate()).to.equal(0);
    expect(await icoManagerContract.exchangeRate()).to.equal(0);
    expect(await icoManagerContract.allocationToInvestors()).to.equal(0);
    await expect(icoManagerContract.stablecoinAddrList(0)).to.be.reverted; 
    expect(await icoManagerContract.ICOTAddress()).to.equal(icotAddress); 


  })
  
  it("Resets ICO variables", async function () {
    expect(await icoManagerContract.stablecoinAddress(daiAddress)).to.equal(false);
    expect(await icoManagerContract.fundImmediateTransfer()).to.equal(immediateTransferRateBig);
    expect(await icoManagerContract.investorsAmounts(addr1.address)).to.equal(0);
    // expect(await icoManagerContract.investorsAddresses(0)).to.be.reverted; 
    expect(await icoManagerContract.stablecoinUsed(addr1.address)).to.equal(ethers.constants.AddressZero); 
    expect(await icoManagerContract.ICOCurrent()).to.equal(ethers.utils.parseEther('0')); 
    expect(await icoManagerContract.minICOTokens()).to.equal(ethers.utils.parseEther('0')); 
    expect(await icoManagerContract.maxICOTokens()).to.equal(ethers.utils.parseEther('0')); 
    expect(await icoManagerContract.timeLimitReached()).to.equal(true); 
  })
  it("ICO Manager has right ICOT Balance", async function () {
    expect(await icotContract.balanceOf(icoManagerAddress)).to.equal(tokensTotalInContract.sub(maxICOTokens)); 
  })
});
