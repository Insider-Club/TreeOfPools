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
const { duration } = require("@openzeppelin/test-helpers/src/time");
  
  describe("Team", async function () {
    beforeEach(async function () {
        //Create ranks
        Team = await ethers.getContractFactory("Team");
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

        team = await Team.deploy();

        //Create USD
        USDT = await ethers.getContractFactory("BEP20Token");
        usdt = await USDT.deploy(6);
    });
    describe("Fund distribution", async function(){
        beforeEach(async function(){
            await usdt.connect(owner).transfer(team.address, 1000000);

            await team.connect(owner).addMember("A", addr1.address, 50, true);
            await team.connect(owner).addMember("B", addr2.address, 25, true);
            await team.connect(owner).addMember("C", addr3.address, 25, true);
        });

        it("Member Registration", async function(){
            expect((await team.getMember("A")).usefulness.toString()).to.equal("50");
            expect((await team.getMember("B")).usefulness.toString()).to.equal("25");
            expect((await team.getMember("C")).usefulness.toString()).to.equal("25");
        });

        it("Full cycle", async function(){
            await team.connect(addr1).claim("A", usdt.address);
            await team.connect(addr2).claim("B", usdt.address);
            await team.connect(addr3).claim("C", usdt.address);


            expect((await usdt.balanceOf(addr1.address)).toString()).to.equal("500000");
            expect((await usdt.balanceOf(addr2.address)).toString()).to.equal("250000");
            expect((await usdt.balanceOf(addr3.address)).toString()).to.equal("250000");

            await usdt.connect(owner).transfer(team.address, 1000000);

            await team.connect(addr1).claim("A", usdt.address);
            await team.connect(addr2).claim("B", usdt.address);
            await team.connect(addr3).claim("C", usdt.address);

            expect((await usdt.balanceOf(addr1.address)).toString()).to.equal("1000000");
            expect((await usdt.balanceOf(addr2.address)).toString()).to.equal("500000");
            expect((await usdt.balanceOf(addr3.address)).toString()).to.equal("500000");
        });
    });
});