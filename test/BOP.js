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
  
  describe("BranchOfPools", async function () {
    beforeEach(async function () {
        //Create ranks
        RANKS = await ethers.getContractFactory("Ranking");
        [owner, addr1, addr2, addr3, devUSDT, fund, ...addrs] = await ethers.getSigners();

        ranks = await RANKS.deploy();

        ranks
            .connect(owner)
            .createRank("Test", ["min", "max", "commission"], [100, 500, 20], true);

        ranks
            .connect(owner)
            .createRank("Test2", ["min", "max", "commission"], [1000, 5000, 10], true);

        //Create USD
        USDT = await ethers.getContractFactory("BEP20Token");
        usdt = await USDT.deploy(6);

        //Create root
        ROOT = await ethers.getContractFactory("RootOfPools_v013");
        root = await ROOT.deploy();
        await root.initialize(usdt.address, ranks.address);

        //Create branch
        BRANCH = await ethers.getContractFactory("BranchOfPools");
        branch = await BRANCH.deploy();
        await branch.init(
            root.address,
            4500000000,
            100,
            devUSDT.address,
            fund.address,
            7,
            50
        );
    });
    describe("States", async function(){
        describe("Pause", async function(){
            describe("Must be performed",async function(){
                it("changeTargetValue", async function(){
                    expect((await branch._VALUE()).toString()).to.equal("4500000000000000"); 

                    await branch.connect(owner).changeTargetValue(5000);

                    expect((await branch._VALUE()).toString()).to.equal("5000"); 
                });

                it("changeStepValue", async function(){
                    expect((await branch._stepValue()).toString()).to.equal("100000000"); 

                    await branch.connect(owner).changeStepValue(200);

                    expect((await branch._stepValue()).toString()).to.equal("200"); 
                });

                it("startFundraising", async function(){
                    expect(await branch._state()).to.equal(0); 

                    await branch.connect(owner).startFundraising();

                    expect(await branch._state()).to.equal(1); 
                });

                it("importTable", async function(){ 
                    expect((await branch.myAllocation(addr1.address)).toString()).to.equal("0");
                    expect((await branch.myAllocation(addr2.address)).toString()).to.equal("0");
                    expect((await branch.myAllocation(addr3.address)).toString()).to.equal("0");

                    await branch.connect(owner).importTable([addr1.address, addr2.address, addr3.address], [100,100,100]);

                    expect((await branch.myAllocation(addr1.address)).toString()).to.equal("100");
                    expect((await branch.myAllocation(addr2.address)).toString()).to.equal("100");
                    expect((await branch.myAllocation(addr3.address)).toString()).to.equal("100");
                });

                it("importFR", async function(){
                    expect(await branch._FUNDS_RAISED()).to.equal(0); 

                    await branch.connect(owner).importFR(1000);

                    expect(await branch._FUNDS_RAISED()).to.equal(1000); 
                });

                it("importCC", async function(){
                    expect(await branch._CURRENT_COMMISSION()).to.equal(0); 

                    await branch.connect(owner).importCC(1000);

                    expect(await branch._CURRENT_COMMISSION()).to.equal(1000); 
                });

                it("closeImport", async function() {
                    expect(await branch._state()).to.equal(0); 

                    await branch.connect(owner).closeImport();

                    expect(await branch._state()).to.equal(2); 
                });
            });

            describe("Must be rejected",async function(){
                describe("changeTargetValue", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).changeTargetValue(50000)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).changeTargetValue(50000)).to.be.reverted;
                    });
                });

                describe("changeStepValue", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).changeStepValue(100)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).changeStepValue(100)).to.be.reverted;
                    });
                });

                describe("startFundraising", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).startFundraising()).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).startFundraising()).to.be.reverted;
                    });
                });

                describe("importTable", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).importTable([addr1.address, addr2.address], [100, 100])).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).importTable([addr1.address, addr2.address], [100, 100])).to.be.reverted;
                    });
                });

                describe("importFR", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).importFR(100)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).importFR(100)).to.be.reverted;
                    });
                });

                describe("importCC", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).importCC(100)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).closeImport();

                        await expect(branch.connect(owner).importCC(100)).to.be.reverted;
                    });
                });

                describe("closeImport", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).closeImport()).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).startFundraising();

                        await expect(branch.connect(owner).closeImport()).to.be.reverted;
                    });
                });
            });
        });

        describe("Fundrasing", async function(){
            beforeEach(async function(){
                await branch.connect(owner).startFundraising();

                await usdt.connect(owner).approve(branch.address, "10000000000000");
            });

            describe("Must be performed",async function(){
                it("stopEmergency", async function(){
                    expect(await branch._state()).to.equal(1);

                    await branch.connect(owner).stopEmergency();

                    expect(await branch._state()).to.equal(4);
                });

                it("deposit", async function(){
                    expect((await branch.myAllocation(owner.address)).toString()).to.equal("0");

                    await branch.connect(owner).deposit("100000000");

                    expect((await branch.myAllocation(owner.address)).toString()).to.equal("80000000");
                });

                it("stopFundraising", async function(){
                    expect(await branch._state()).to.equal(1);

                    await branch.connect(owner).stopFundraising();
    
                    expect(await branch._state()).to.equal(2);
                });

                it("changeTargetValue", async function(){
                    expect((await branch._VALUE()).toString()).to.equal("4500000000000000"); 

                    await branch.connect(owner).changeTargetValue(5000);

                    expect((await branch._VALUE()).toString()).to.equal("5000"); 
                });

                it("changeStepValue", async function(){
                    expect((await branch._stepValue()).toString()).to.equal("100000000"); 

                    await branch.connect(owner).changeStepValue(200);

                    expect((await branch._stepValue()).toString()).to.equal("200"); 
                });
            });

            describe("Must be rejected",async function(){
                describe("stopEmergency", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).stopEmergency()).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).deposit("100000000");
                        await branch.connect(owner).stopFundraising();

                        TOKEN = await ethers.getContractFactory("SimpleToken");
                        token = await TOKEN.deploy("Test", "TST", 10000);
                        await token.connect(owner).transfer(branch.address, 10000);
                        await branch.connect(owner).entrustToken(token.address);

                        await expect(branch.connect(owner).stopEmergency()).to.be.reverted;
                    });
                });

                describe("deposit", async function(){
                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).stopEmergency();

                        await expect(branch.connect(owner).deposit(100000000)).to.be.reverted;
                    });

                    it("If the user did not allow the money to be used", async function(){
                        await usdt.connect(owner).approve(branch.address, 0);

                        await expect(branch.connect(owner).deposit(100000000)).to.be.reverted;
                    });

                    it("If the user deposits too little", async function(){
                        await expect(branch.connect(owner).deposit(1)).to.be.reverted;
                    });

                    it("If the user deposits too much", async function(){
                        await expect(branch.connect(owner).deposit(10000000000)).to.be.reverted;
                    });

                    it("If the user deposits without complying with the step", async function(){
                        await expect(branch.connect(owner).deposit(10000000000)).to.be.reverted;
                    });

                    it("If the user exceeds the amount of funds collected", async function(){
                        await branch.connect(owner).changeTargetValue(1);

                        await expect(branch.connect(owner).deposit(100000000)).to.be.reverted;
                    });
                });

                describe("stopFundraising", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).stopFundraising()).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).stopEmergency();

                        await expect(branch.connect(owner).stopFundraising()).to.be.reverted;
                    });
                });

                describe("changeTargetValue", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).changeTargetValue(50000)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).stopFundraising();

                        await expect(branch.connect(owner).changeTargetValue(50000)).to.be.reverted;
                    });
                });

                describe("changeStepValue", async function(){
                    it("If the caller is not the owner", async function(){
                        await expect(branch.connect(addr1).changeStepValue(100)).to.be.reverted;
                    });

                    it("If called in an inappropriate state", async function(){
                        await branch.connect(owner).stopFundraising();

                        await expect(branch.connect(owner).changeStepValue(100)).to.be.reverted;
                    });
                });
            });
        });

        describe("WaitingToken", async function(){
            beforeEach(async function(){
                await branch.connect(owner).startFundraising();

                await usdt.connect(owner).approve(branch.address, "10000000000000");

                await branch.connect(owner).deposit(100000000);
                await branch.connect(owner).stopFundraising();
            });
            describe("Must be performed",async function(){
                it("entrustToken", async function(){
                    TOKEN = await ethers.getContractFactory("SimpleToken");
                    token = await TOKEN.deploy("Test", "TST", 10000);
                    await token.connect(owner).transfer(branch.address, 10000);
                    await branch.connect(owner).entrustToken(token.address);

                    expect(await branch._token()).to.equal(token.address);
                });

            });
            describe("Must be rejected",async function() {
                describe("entrustToken", async function() {
                    it("If the caller is not the owner", async function(){
                        TOKEN = await ethers.getContractFactory("SimpleToken");
                        token = await TOKEN.deploy("Test", "TST", 10000);
                        await token.connect(owner).transfer(branch.address, 10000);

                        await expect(branch.connect(addr1).entrustToken(token.address)).to.be.reverted;
                    });

                    it("If developers will try to distribute different tokens",async function() {
                        TOKEN = await ethers.getContractFactory("SimpleToken");
                        token = await TOKEN.deploy("Test", "TST", 10000);
                        await token.connect(owner).transfer(branch.address, 10000);
                        await branch.connect(owner).entrustToken(token.address);

                        token2 = await TOKEN.deploy("Test", "TST", 10000);
                        await token2.connect(owner).transfer(branch.address, 10000);
                        
                        await expect(branch.connect(owner).entrustToken(token2.address)).to.be.reverted;
                    });
                });
            });
        });

        describe("TokenDistribution", async function() {
            beforeEach(async function() {
                await branch.connect(owner).startFundraising();

                await usdt.connect(owner).approve(branch.address, "10000000000000");

                await branch.connect(owner).deposit(100000000);
                await branch.connect(owner).stopFundraising();

                TOKEN = await ethers.getContractFactory("SimpleToken");
                token = await TOKEN.deploy("Test", "TST", 10000);
                await branch.connect(owner).entrustToken(token.address);
                await token.connect(owner).transfer(branch.address, 10000);
            });
            describe("Must be performed",async function() {
                it("claim", async function(){
                    await branch.connect(owner).claim();

                    expect((await branch.connect(owner).myCurrentAllocation(owner.address)).toString()).to.equal("0");
                });
            });
            describe("Must be rejected",async function() {
                describe("claim", async function(){
                    it("If the user has not funded the account, but tries to brandish", async function(){
                        await expect(branch.connect(addr1).claim()).to.be.reverted;
                    });

                    it("If the user tries to brand the tokens before the next unlock", async function(){
                        await branch.connect(owner).claim()

                        await expect(branch.connect(owner).claim()).to.be.reverted;
                    });
                });
            });
        });

        describe("Emergency", async function() {
            beforeEach(async function() {
                await branch.connect(owner).startFundraising();

                await usdt.connect(owner).approve(branch.address, "10000000000000");

                await branch.connect(owner).deposit(100000000);
                await branch.connect(owner).stopEmergency();
            });
            describe("Must be performed",async function() {
                it("paybackEmergency", async function(){
                    expect((await usdt.connect(owner).balanceOf(owner.address)).toString()).to.equal("115792089237316195423570985008687907853269984665640564039457584007913029639935");

                    await branch.connect(owner).paybackEmergency();

                    expect((await usdt.connect(owner).balanceOf(owner.address)).toString()).to.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");
                });
            });
            describe("Must be rejected",async function() {
                describe("paybackEmergency", async function(){
                    it("If the user did not deposit money, but is trying to get it back", async function(){
                        await expect(branch.connect(addr1).paybackEmergency()).to.be.reverted;
                    });
                });
            });
        });
    });
  });