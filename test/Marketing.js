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
  
  describe("Marketing", async function () {
    beforeEach(async function () {
        //Create ranks
        MARK = await ethers.getContractFactory("Marketing");
        [owner, global, addr2, addr3, addr4, addr5, ...addrs] = await ethers.getSigners();

        mark = await MARK.deploy(global.address);

        //Create USD
        USDT = await ethers.getContractFactory("BEP20Token");
        usdt = await USDT.deploy(6);
    });
    describe("Fund distribution", async function(){
        beforeEach(async function(){
            await usdt.connect(owner).transfer(mark.address, 1000000);

            await mark.connect(owner).addProject("Test", 2000000, 1999561830, usdt.address);
        });

        it("Project Registration", async function(){
            expect((await mark.getTotalValue("Test")).toString()).to.equal("2000000");
        });

        it("Full cycle", async function(){
            await mark.connect(owner).setProjectAmounts("Test", [addr2.address, addr3.address, addr4.address], [1000000, 500000, 500000]);

            expect((await mark.connect(addr2).getUserAmount("Test", addr2.address)).toString()).to.equal("1000000");
            expect((await mark.connect(addr3).getUserAmount("Test", addr3.address)).toString()).to.equal("500000");
            expect((await mark.connect(addr4).getUserAmount("Test", addr4.address)).toString()).to.equal("500000");

            await mark.connect(owner).closeProject("Test");

            await mark.connect(addr2).claim("Test");
            await mark.connect(addr3).claim("Test");
            await mark.connect(addr4).claim("Test");


            expect((await usdt.balanceOf(addr2.address)).toString()).to.equal("500000");
            expect((await usdt.balanceOf(addr3.address)).toString()).to.equal("250000");
            expect((await usdt.balanceOf(addr4.address)).toString()).to.equal("250000");

            await usdt.connect(owner).transfer(mark.address, 1000000);

            await mark.connect(addr2).claim("Test");
            await mark.connect(addr3).claim("Test");
            await mark.connect(addr4).claim("Test");

            expect((await usdt.balanceOf(addr2.address)).toString()).to.equal("1000000");
            expect((await usdt.balanceOf(addr3.address)).toString()).to.equal("500000");
            expect((await usdt.balanceOf(addr4.address)).toString()).to.equal("500000");
        });
    });
});