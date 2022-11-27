const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");

describe("Ranking", async function () {
  describe("Must be performed", async function(){
    beforeEach(async function () {
      RANKS = await ethers.getContractFactory("Ranking");
      [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  
      ranks = await RANKS.deploy();
  
      ranks
        .connect(owner)
        .createRank("Test", ["min", "max", "commission"], [100, 500, 20], true);
  
        ranks
        .connect(owner)
        .createRank("Test2", ["min", "max", "commission"], [1000, 5000, 10], true);
    });

    it("giveRanks", async function() {
      expect((await ranks.getRank(addr1.address))[0]).to.equal("Test");
      expect((await ranks.getRank(addr2.address))[0]).to.equal("Test");
      expect((await ranks.getRank(addr3.address))[0]).to.equal("Test");

      await ranks.connect(owner).giveRanks([addr1.address, addr2.address, addr3.address], "Test2");

      expect((await ranks.getRank(addr1.address))[0]).to.equal("Test2");
      expect((await ranks.getRank(addr2.address))[0]).to.equal("Test2");
      expect((await ranks.getRank(addr3.address))[0]).to.equal("Test2");
    });

    it("giveRank", async function() {
      expect((await ranks.getRank(addr1.address))[0]).to.equal("Test");

      await ranks.connect(owner).giveRank(addr1.address, "Test2");

      expect((await ranks.getRank(addr1.address))[0]).to.equal("Test2");
    });

    it("createRank", async function() {
      expect((await ranks.showRanks()).length).to.equal(2);

      await ranks.createRank("Test3", ["min", "max", "commission"], [1000, 5000, 10], true);

      rank = await ranks.showRanks();

      expect(rank.length).to.equal(3);
      expect(rank[2][0]).to.equal("Test3");
      expect(rank[2][1][0]).to.equal("min");
      expect(rank[2][1][1]).to.equal("max");
      expect(rank[2][1][2]).to.equal("commission");
      expect(rank[2][2][0].toString()).to.equal("1000");
      expect(rank[2][2][1].toString()).to.equal("5000");
      expect(rank[2][2][2].toString()).to.equal("10");
      expect(rank[2][3]).to.equal(true);
    });

    it("changeRank", async function() {
      rank = await ranks.showRank("Test");

      expect(rank[0]).to.equal("Test");
      expect(rank[1][0]).to.equal("min");
      expect(rank[1][1]).to.equal("max");
      expect(rank[1][2]).to.equal("commission");
      expect(rank[2][0].toString()).to.equal("100");
      expect(rank[2][1].toString()).to.equal("500");
      expect(rank[2][2].toString()).to.equal("20");
      expect(rank[3]).to.equal(true);

      await ranks.connect(owner).changeRank("Test", ["min", "max", "commission"], [200, 600,30], true);

      rank = await ranks.showRank("Test");

      expect(rank[0]).to.equal("Test");
      expect(rank[1][0]).to.equal("min");
      expect(rank[1][1]).to.equal("max");
      expect(rank[1][2]).to.equal("commission");
      expect(rank[2][0].toString()).to.equal("200");
      expect(rank[2][1].toString()).to.equal("600");
      expect(rank[2][2].toString()).to.equal("30");
      expect(rank[3]).to.equal(true);
    });

    it("changeRankParNames", async function(){
      rank = await ranks.showRank("Test");

      expect(rank[1][0]).to.equal("min");
      expect(rank[1][1]).to.equal("max");
      expect(rank[1][2]).to.equal("commission");

      await ranks.connect(owner).changeRankParNames("Test", ["MIN", "MAX", "COMMISSION"]);

      rank = await ranks.showRank("Test");

      expect(rank[1][0]).to.equal("MIN");
      expect(rank[1][1]).to.equal("MAX");
      expect(rank[1][2]).to.equal("COMMISSION");
    });

    it("changeRankParValues", async function(){
      rank = await ranks.showRank("Test");

      expect(rank[2][0].toString()).to.equal("100");
      expect(rank[2][1].toString()).to.equal("500");
      expect(rank[2][2].toString()).to.equal("20");

      await ranks.connect(owner).changeRankParValues("Test", [200, 300, 10]);

      rank = await ranks.showRank("Test");

      expect(rank[2][0].toString()).to.equal("200");
      expect(rank[2][1].toString()).to.equal("300");
      expect(rank[2][2].toString()).to.equal("10");
    });

    it("lockRank", async function() {
      rank = await ranks.showRank("Test");

      expect(rank[3]).to.equal(true);

      await ranks.connect(owner).lockRank("Test");

      rank = await ranks.showRank("Test");

      expect(rank[3]).to.equal(false);
    });

    it("renameRankParam", async function() {
      rank = await ranks.showRank("Test");

      expect(rank[1][1]).to.equal("max");

      await ranks.connect(owner).renameRankParam("Test", "MAX", 1);

      rank = await ranks.showRank("Test");

      expect(rank[1][1]).to.equal("MAX");
    });

    it("changeRankParam", async function() {
      rank = await ranks.showRank("Test");

      expect(rank[2][1].toString()).to.equal("500");

      await ranks.connect(owner).changeRankParam("Test", 600, 1);

      rank = await ranks.showRank("Test");

      expect(rank[2][1].toString()).to.equal("600");
    });

    it("renameRank", async function(){
      rank = (await ranks.showRanks())[0];

      expect(rank[0]).to.equal("Test");

      await ranks.connect(owner).renameRank("Test", "Test1");

      rank = (await ranks.showRanks())[0];

      expect(rank[0]).to.equal("Test1");
    });
  });

  describe("Must be rejected", async function(){
    beforeEach(async function () {
      RANKS = await ethers.getContractFactory("Ranking");
      [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  
      ranks = await RANKS.deploy();
  
      ranks
        .connect(owner)
        .createRank("Test", ["min", "max", "commission"], [100, 500, 20], true);
  
        ranks
        .connect(owner)
        .createRank("Test2", ["min", "max", "commission"], [1000, 5000, 10], true);
    });

    describe("giveRanks", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).giveRanks([addr1.address, addr2.address, addr3.address], "Test2")).to.be.reverted;
      });
    });

    describe("giveRank", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).giveRank(addr1.address, "Test2")).to.be.reverted;
      });
    });

    describe("createRank", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).createRank("Test3", ["min", "max", "commission"], [1000, 5000, 10], true)).to.be.reverted;
      });

      it("Creating a rank with the wrong combination of parameters",async function(){
        await expect(ranks.connect(owner).createRank("Test3", ["min", "max", "commission"], [1000, 5000], true)).to.be.reverted;
      });
    });

    describe("changeRank", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).changeRank("Test2", ["min", "max", "commission"], [1000, 5000, 10], true)).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).changeRank("Test2", ["min", "max", "commission"], [1000, 5000, 10], true)).to.be.reverted;
      });

      it("Changing a rank with the wrong combination of parameters",async function(){
        await expect(ranks.connect(owner).changeRank("Test2", ["min", "max", "commission"], [1000, 5000], true)).to.be.reverted;
      });
    });

    describe("changeRankParNames", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).changeRankParNames("Test2", ["min", "max", "commission"])).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).changeRankParNames("Test2", ["min", "max", "commission"])).to.be.reverted;
      });

      it("Changing a rank with the wrong combination of parameters",async function(){
        await expect(ranks.connect(owner).changeRankParNames("Test2", ["min", "max"])).to.be.reverted;
      });
    });

    describe("changeRankParValues", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).changeRankParValues("Test2", [100, 200, 10])).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).changeRankParValues("Test2", [100, 200, 10])).to.be.reverted;
      });

      it("Changing a rank with the wrong combination of parameters",async function(){
        await expect(ranks.connect(owner).changeRankParValues("Test2", [100, 200])).to.be.reverted;
      });
    });

    describe("renameRankParam", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).renameRankParam("Test2", "MAX", 1)).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).renameRankParam("Test2", "MAX", 1)).to.be.reverted;
      });
    });

    describe("changeRankParam", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).changeRankParam("Test2", 600, 1)).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).changeRankParam("Test2", 600, 1)).to.be.reverted;
      });
    });

    describe("renameRank", async function(){
      it("If the caller is not the owner", async function(){
        await expect(ranks.connect(addr1).renameRank("Test2", "Test3")).to.be.reverted;
      });

      it("Changing a locked rank",async function(){
        await expect(ranks.connect(owner).lockRank("Test2"));

        await expect(ranks.connect(owner).renameRank("Test2", "Test3")).to.be.reverted;
      });
    });
  });

  describe("Other cases", async function(){
      beforeEach(async function(){
        RANKS = await ethers.getContractFactory("Ranking");
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  
        ranks = await RANKS.deploy();
      });
      it("Attempting to change a rank that does not exist", async function(){
        await expect(ranks.connect(owner).changeRank("Test", ["min", "max", "commission"], [1000, 5000, 10], true)).to.be.reverted;
      })
  });
});
