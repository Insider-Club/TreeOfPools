const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const BOPArtifacts = require("../artifacts/contracts/BOP.sol/BranchOfPools.json");
const BOPImportArtifacts = require("../artifacts/contracts/BOP_import.sol/BranchOfPools_import.json");

describe("Root of Pools", async function () {
  beforeEach(async function () {
    Ranks = await ethers.getContractFactory("Ranking");
    [owner, addr1, addr2, addr3, devUSDT, dev, fund, ...addrs] =
      await ethers.getSigners();

    ranks = await Ranks.deploy();
    own_ranks = ranks.connect(owner);
    own_ranks.createRank(
      "Common",
      ["Min", "Max", "Commission"],
      [100, 500, 20],
      true
    );

    own_ranks.createRank(
      "Rare",
      ["Min", "Max", "Commission"],
      [100, 1000, 20],
      true
    );

    own_ranks.createRank(
      "Legendary",
      ["Min", "Max", "Commission"],
      [100, 1000, 20],
      true
    );

    own_ranks.createRank(
      "Admin",
      ["Min", "Max", "Commission"],
      [0, 10000, 0],
      true
    );

    await own_ranks.giveRank(owner.address, "Admin");

    USDT = await ethers.getContractFactory("BEP20Token");
    usdt = await USDT.deploy(6);

    MSig = await ethers.getContractFactory("MultiSigWallet");
    msig = await MSig.deploy([owner.address, addr1.address, addr2.address], 2);
    await msig.deployed();

    Root = await ethers.getContractFactory("RootOfPools_v2");
    root = await upgrades.deployProxy(Root, [usdt.address, ranks.address], {
      initializer: "initialize",
    });

    await root.deployed();

    Branch = await ethers.getContractFactory("BranchOfPools");
    example = await Branch.deploy();

    await root.connect(owner).addImage(example.address);

    BranchImport = await ethers.getContractFactory("BranchOfPools_import");
    exampleImport = await BranchImport.deploy();

    await root.connect(owner).addImage(exampleImport.address);

    MARK = await ethers.getContractFactory("Marketing");
    mark = await MARK.deploy(root.address);
    await root.connect(owner).setMarketing(mark.address);

    await root.connect(owner).setMarketingWallet(root.address);

    Team = await ethers.getContractFactory("Team");
    team = await Team.deploy();
    await root.connect(owner).setTeam(team.address);

    await root.connect(owner).transferOwnership(msig.address);
  });

  describe("Rank System", async function () {
    it("Parameters must be in the initial state", async function () {
      expect(await ranks.owner()).to.equal(owner.address);
      expect(await ranks.getNameParRank("Common")).to.have.lengthOf(3);
      expect(await ranks.getParRank("Common")).to.have.lengthOf(3);
    });
  });

  describe("Main Functional", async function () {
    beforeEach(async function () {
      tx1 = await example.populateTransaction.init(
        root.address,
        4500,
        100,
        devUSDT.address,
        fund.address,
        7,
        50,
        usdt.address
      );

      tx = await root.populateTransaction.createPool("Test", 0, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      tx1 = await example.populateTransaction.init(
        root.address,
        4500,
        100,
        devUSDT.address,
        fund.address,
        7,
        50,
        usdt.address
      );

      tx = await root.populateTransaction.createPool("TestImport", 1, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      POOL = (String(await root.Pools(0)).split(','))[0];
      POOL_IMPORT = (String(await root.Pools(1)).split(','))[0];
      branch = new ethers.Contract(POOL, BOPArtifacts.abi, ethers.provider)
      branchImport = new ethers.Contract(POOL_IMPORT, BOPImportArtifacts.abi, ethers.provider)
    });

    it("Check if the child contract is connected successfully", async function () {
      pools = await root.getPools();
      expect(pools).to.have.lengthOf(2);
      expect(pools[0][1]).to.equal("Test");
    });

    /*it("Emergency Stop Fundraising", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      expect((await usdt.balanceOf(addr1.address)).toString()).to.equal(
        "1000000000"
      );
      expect((await usdt.balanceOf(addr2.address)).toString()).to.equal(
        "1000000000"
      );

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test",500000000);
      await root.connect(addr2).deposit("Test",500000000);

      expect((await branch.myAllocationEmergency(addr1.address)).toString()).to.equal("500000000");
      expect((await branch.myAllocationEmergency(addr2.address)).toString()).to.equal("500000000");

      //Emergency stop
      tx1 = await branch.populateTransaction.stopEmergency();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Users return funds
      tx1 = await branch.connect(addr1).paybackEmergency();
      tx1 = await branch.connect(addr2).paybackEmergency();

      //The money should come back
      expect((await usdt.balanceOf(addr1.address)).toString()).to.equal(
        "1000000000"
      );
      expect((await usdt.balanceOf(addr2.address)).toString()).to.equal(
        "1000000000"
      );
    });*/

    it("Should be through a full cycle of deposit and mandatory completion of collection with a double unlocks", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);
      await usdt.connect(owner).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test",500000000); //500 usdt
      await root.connect(addr2).deposit("Test",500000000);
      await root.connect(addr3).deposit("Test",200000000);
      await root.connect(owner).deposit("Test",100000000);

      tx1 = await branch.populateTransaction.preSend(100000000);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "100000000"
      );

      //Close fundraising Test pool
      tx1 = await branch.populateTransaction.stopFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //tx1 = await branch.connect(owner).getCommission();

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "1060000000"
      ); // 800 usdt
      
      /*expect((await usdt.balanceOf(msig.address)).toString()).to.equal(
        "72000000"
      );
      expect((await usdt.balanceOf(fund.address)).toString()).to.equal(
        "33600000"
      ); // 33,6 usdt*/

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 90000);

      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);
      

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(owner).claim();

      tx1 = await branch.populateTransaction.getCommission();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(root.address)).toString()).to.equal(
        "82900000"
      );

      expect((await token.balanceOf(msig.address)).toString()).to.equal(
        "7634" //bfor 33750
      );

      expect((await token.balanceOf(mark.address)).toString()).to.equal(
        "13500" //marketing
      );
      expect((await token.balanceOf(team.address)).toString()).to.equal(
        "1800" //team wallet
      );

      await branch.connect(addr2).claim();


      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "21226"
      );
      expect((await token.balanceOf(mark.address)).toString()).to.equal(
        "13500" //marketing
      );
      expect((await token.balanceOf(team.address)).toString()).to.equal(
        "1800" //team wallet
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "21226"
      );

      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "8490"
      );

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");

      await token.connect(dev).transfer(branch.address, 90000);
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      await branch.connect(fund).getCommission();
      expect((await usdt.balanceOf(fund.address)).toString()).to.equal(
        "74200000"
      );

      //Claim tokens
      await branch.connect(addr1).claim();

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("21226");

      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();
      await branch.connect(addr3).claim();
      await branch.connect(owner).claim();

      tx1 = await branch.populateTransaction.getCommission();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(owner).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "42452"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "42452"
      );
      expect((await token.balanceOf(addr3.address)).toString()).to.equal(
        "16981"
      );
      expect((await token.balanceOf(owner.address)).toString()).to.equal(
        "16981"
      );
      expect((await token.balanceOf(mark.address)).toString()).to.equal(
        "27000"
      );
      expect((await token.balanceOf(team.address)).toString()).to.equal(
        "3600"
      );
      expect((await token.balanceOf(msig.address)).toString()).to.equal(
        "15267"
      );
      expect((await token.balanceOf(root.address)).toString()).to.equal(
        "15267"
      );
      expect((await token.balanceOf(branch.address)).toString()).to.equal(
        "0"
      );
    });

    /*it("Checking basic math", async function () {
      a = 100000000; //Колличество денег
      b = 200000000;
      c = 300000000;
      d = 100000000;
      del_tokens = 2900; //Колличество токенов от разработчиков за 1 раз разлока

      a_k = Math.floor(a - a * 0.2); //С комиссиями
      b_k = Math.floor(b - b * 0.2);
      c_k = Math.floor(c - c * 0.2);

      toContract = Math.floor(//181
        (del_tokens * ((a + b + c) / 2)) / (a_k + b_k + c_k)
      );
      toOwner = Math.floor(del_tokens - toContract);
      console.log("toOwner first razlok- ", toOwner);

      a_tpu = Math.floor(toContract * (a_k / (a_k + b_k + c_k + d)));
      b_tpu = Math.floor(toContract * (b_k / (a_k + b_k + c_k + d)));
      c_tpu = Math.floor(toContract * (c_k / (a_k + b_k + c_k + d)));

      a_f = Math.floor(2 * a_tpu);
      b_f = Math.floor(2 * b_tpu);
      c_f = Math.floor(2 * c_tpu);

      console.log(a_f);
      console.log(b_f);
      console.log(c_f);

      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Get rank for addr2 and addr3
      await ranks.connect(owner).giveRank(addr2.address, "Rare");
      await ranks.connect(owner).giveRank(addr3.address, "Legendary");

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);
      await usdt.connect(owner).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test",a);
      await root.connect(addr2).deposit("Test",b);
      await root.connect(addr3).deposit("Test",c);
      await root.connect(owner).deposit("Test",d);

      //Close fundraising Test pool
      tx1 = await branch.populateTransaction.stopFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);
      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, del_tokens);
      
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      /*expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal(a_tpu.toString());
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal(b_tpu.toString());
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal(c_tpu.toString());*/

      /*console.log(await branch.connect(addr1).myCurrentAllocation(addr1.address))
      console.log(await branch.connect(addr2).myCurrentAllocation(addr2.address))
      console.log(await branch.connect(addr3).myCurrentAllocation(addr3.address))
      console.log(await branch.connect(owner).myCurrentAllocation(owner.address))
      
      //Claim tokens
      await root.connect(addr1).claimName("Test");
      await root.connect(addr3).claimName("Test");

      //Next unlocks
      await token.connect(dev).transfer(branch.address, del_tokens);
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();
      await branch.connect(owner).claim();
      await root.connect(addr3).claimName("Test");


      console.log("Msig - ",await token.balanceOf(msig.address));

      console.log("Addr1 - ",await token.balanceOf(addr1.address));
      console.log("Addr2 - ",await token.balanceOf(addr2.address));
      console.log("Addr3 - ",await token.balanceOf(addr3.address));
      console.log("Addr4 - ",await token.balanceOf(owner.address));
      console.log("Branch - ",await token.balanceOf(branch.address));
      console.log("CC - ", await branch._CURRENT_COMMISSION());
    });

    it("Checking Price Independence", async function () {
      //Give some usdt user addr1 and addr2
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);
      await usdt.connect(owner).transfer(addr3.address, 1000000000);

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);
      await usdt.connect(addr3).approve(branch.address, 1000000000);

      await root.connect(addr1).deposit("Test",500000000); //500 usdt
      await root.connect(addr2).deposit("Test",500000000); //500
      await branch.connect(addr3).deposit(500000000); //500

      //Close fundraising Test pool
      tx1 = await branch.populateTransaction.stopFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);
      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 800);
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();
      await branch.connect(addr3).claim();

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("0");

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 800);
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();
      await root.connect(addr3).claimName("Test");

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("0");

      expect((await token.balanceOf(addr1.address)).toString()).to.equal("333");
      expect((await token.balanceOf(addr2.address)).toString()).to.equal("333");
      expect((await token.balanceOf(addr3.address)).toString()).to.equal("333");
    });

    it("Check max value deposit", async function(){
      await usdt.connect(owner).transfer(addr1.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
      await usdt.connect(addr1).approve(branch.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(root.connect(addr1).deposit("Test","Test", "115792089237316195423570985008687907853269984665640564039457584007913129639935")).to.be.reverted;
    });

    it("Check +1 token bag", async function(){
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await usdt.connect(owner).transfer(branch.address, 1);

      await root.connect(addr1).deposit("Test",500000000); //500 usdt
      await root.connect(addr2).deposit("Test",500000000);

      //Close fundraising Test pool
      tx1 = await branch.populateTransaction.stopFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "800000000"
      ); // 800 usdt

      //Create new token for entrust
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(dev.address, 1000000);
      await token.connect(dev).transfer(branch.address, 90000);

      await token.connect(dev).transfer(branch.address, 1);

      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "28125"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "28125"
      );

      //Next unlocks
      await token.connect(dev).transfer(branch.address, 90000);
      tx1 = await branch.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branch.connect(addr1).claim();
      await branch.connect(addr2).claim();

      expect(
        (
          await branch.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branch.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect((await token.balanceOf(addr1.address)).toString()).to.equal(
        "56250"
      );
      expect((await token.balanceOf(addr2.address)).toString()).to.equal(
        "56250"
      );

      tx1 = await branch.populateTransaction.getCommission();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await token.balanceOf(msig.address)).toString()).to.equal(
        "18450"
      );
    });

    it("Check for a refund from the developer", async function(){
      await usdt.connect(owner).transfer(addr1.address, 1000000000); //1000 usdt
      await usdt.connect(owner).transfer(addr2.address, 1000000000);

      //Open deposit in Test pool
      tx1 = await branch.populateTransaction.startFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Deposit in Test pool
      await usdt.connect(addr1).approve(branch.address, 1000000000);
      await usdt.connect(addr2).approve(branch.address, 1000000000);

      await usdt.connect(owner).transfer(branch.address, 1);

      await root.connect(addr1).deposit("Test",500000000); //500 usdt
      await root.connect(addr2).deposit("Test",500000000);

      //Close fundraising Test pool
      tx1 = await branch.populateTransaction.stopFundraising();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect((await usdt.balanceOf(devUSDT.address)).toString()).to.equal(
        "800000000"
      ); // 800 usdt

      //Refund from dev
      await usdt.connect(devUSDT).transfer(branch.address, 800000000);
      

      //Try stop
      tx1 = await branch.populateTransaction.stopEmergency();
      tx2 = await root.populateTransaction.Calling(branch.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(await branch._state()).to.equal(4);

    });*/

    it("Data import check", async function(){
      let UsersNumber = 400; //Number of users participating in this test
      users = [];
      values = [];
      commissions = [];
      FR = UsersNumber * 100; //Share of each participant after subtracting the commission of 100
      CC = FR * 0,2;

      for(i = 0; i < UsersNumber; i++){
        users[i] = ethers.Wallet.createRandom().address;
        values[i] = 100;
        commissions[i] = true;
        //console.log(users[i]);
      }

      tx1 = await branchImport.populateTransaction.importTable(users, values, commissions);
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      tx1 = await branchImport.populateTransaction.importFR(FR);
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      tx1 = await branchImport.populateTransaction.closeImport();
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      for(i = 0; i < UsersNumber; i++){
        expect(await branchImport.myAllocationEmergency(users[i])).to.equal(100);
      }

    });

    it("Check import function", async function(){

      //Import Table
      tx1 = await branchImport.populateTransaction.importTable([owner.address, addr1.address, addr2.address, addr3.address], [1000, 100, 200, 300], [false, false, false, false]);
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Import FR
      tx1 = await branchImport.populateTransaction.importFR(1600);
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      tx1 = await branchImport.populateTransaction.closeImport();
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(await branchImport._state()).to.equal(2);

      expect((await branchImport.myAllocationEmergency(addr1.address)).toString()).to.equal(
        "100"
      );
      expect((await branchImport.myAllocationEmergency(addr2.address)).toString()).to.equal(
        "200"
      );
      expect((await branchImport.myAllocationEmergency(addr3.address)).toString()).to.equal(
        "300"
      );


      //Unlock
      Token = await ethers.getContractFactory("SimpleToken");
      token = await Token.deploy("TEST", "TEST", 1000000);

      await token.connect(owner).transfer(branchImport.address, 800);
      tx1 = await branchImport.populateTransaction.entrustToken(token.address);
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      //Claim tokens
      await branchImport.connect(addr1).claim();
      await branchImport.connect(addr2).claim();

      tx1 = await branchImport.populateTransaction.getCommission();
      tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
      await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
      id = (await msig.transactionCount()) - 1;
      await msig.connect(addr1).confirmTransaction(id);

      expect(
        (
          await branchImport.connect(addr1).myCurrentAllocation(addr1.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branchImport.connect(addr2).myCurrentAllocation(addr2.address)
        ).toString()
      ).to.equal("0");
      expect(
        (
          await branchImport.connect(addr3).myCurrentAllocation(addr3.address)
        ).toString()
      ).to.equal("75");

      await token.connect(owner).transfer(branchImport.address, 800);

      await branchImport.connect(addr3).claim();

      expect(
        (
          await token.connect(addr3).balanceOf(addr3.address)
        ).toString()
      ).to.equal("150");

    });
  });
});
