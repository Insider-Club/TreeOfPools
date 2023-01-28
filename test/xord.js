const {
    BN, // Big Number support
    constants, // Common constants, like the zero address and largest integers
    expectEvent, // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
  } = require("@openzeppelin/test-helpers");
  const { inputToConfig } = require("@ethereum-waffle/compiler");
  const { expect } = require("chai");
  const { ethers, upgrades } = require("hardhat");
  const fs = require('fs');
  const readline = require('readline');
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
      
      it("exord check", async function(){
        const fileStream = fs.createReadStream('usrs.txt');
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        usersLength = 0
        users = []
        for await (const line of rl) {
            users[usersLength] = line
            usersLength++
            
        }
        users[usersLength] = owner.address
        values = [100,300,100,100,100,100,100,100,100,100,200,100,200,100,100,200,200,300,100,100,100,100,200,100,300,300,100,100,200,100,100,100,100,300,100,101,100,300,100,100,100,100,100,100,100,100,200,100,200,200,300,100,100,100,100,300,100,100,100,100,100,100,200,200,300,100,100,100,100,300,100,100,200,300,100,100,100,100,100,101,200,300,100,100,300,100,100,200,100,100,100,100,100,100,300,100,100,200,101,100,100,100,301,150,100,100,300,100,100,100,100,100,300,100,100,100,100,100,300,100,300,100,100,100,200,100,100,100,100,100,200,100,200,300,100,100,100,100,100,100,100,300,100,100,300,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,300,100,100,100,100,100,100,100,100,100,100,100,100,300,100,101,100,100,101,200,300,100,101,100,100,100,100,100,100,200,300,101,100,100,100,100,100,100,100,200,100,100,100,100,100,100,100,100,100,299,100,100,100,100,100,100,100,100,100,200,100,100,100,100,100,100,100,100,100,100,300,100,100,100,100,300,100,100,100,100,100,300,100,100,100,200,100,200,300,100,100,100,100,100,100,100,100,199,300,100,100,100,100,100,300,300,100,100,100,300,100,100,100,100,100,100,300,300,100,100,100,100,100,100,100,100,100,300,300,101,100,300,100,200,250,100,100,100,100,100,100,100,100,100,100,150,100,100,100,643];        
        commissions = [];
        FR = 42400; //Share of each participant after subtracting the commission of 100
        CC = FR * 0,2;

        step = 100

        //expect(users.length).to.equal(values.length);
        for (i = 0; i <= users.length / step; i++){
            sendU = []
            sendV = []
            sendC = []

            console.log(i, " -> ", users.length / step)
            if (i > (users.length / step) - 1){
                k = 0
                for(j = i * step; j < users.length; j++){
                    sendU[k] = users[j]
                    sendV[k] = values[j]
                    sendC[k] = false
                    
                    k++
                }
            } else {
                k = 0
                for(j = i * step; j < (i * step) + step; j++){
                    
                    sendU[k] = users[j]
                    sendV[k] = values[j]
                    sendC[k] = false
                    k++
                }
            }

            //console.log(sendU)
            tx1 = await branchImport.populateTransaction.importTable(sendU, sendV, sendC);
            tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
            await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
            id = (await msig.transactionCount()) - 1;
            await msig.connect(addr1).confirmTransaction(id);
        }

        
  
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
  
        for(i = 0; i < users.length; i++){
            flag = true
            for(j = i + 1; j < users.length; j++){
                if(users[i] == users[j]){
                    flag = false
                }
            }

            if (flag){
                //expect(await branchImport.myAllocationEmergency(users[i])).to.equal(100);
                tmp = await branchImport.myAllocationEmergency(users[i])
                if (tmp != values[i]) {
                    console.log("FUCK ", users[i], " ", values[i], " != ", tmp)
                }
            }
        }

        Token = await ethers.getContractFactory("SimpleToken");
        token = await Token.deploy("TEST", "TEST", 1000000000000);
        await token.connect(owner).transfer(branchImport.address, 188444);
        tx1 = await branch.populateTransaction.entrustToken(token.address);
        tx2 = await root.populateTransaction.Calling(branchImport.address, tx1.data);
        await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
        id = (await msig.transactionCount()) - 1;
        await msig.connect(addr1).confirmTransaction(id);

        sum = 0;
        /*for(i = 0; i < users.length; i++){
            flag = true
            for(j = i + 1; j < users.length; j++){
                if(users[i] == users[j]){
                    flag = false
                }
            }
//проверить что выдано все как надо
            if (flag){
                //expect(await branchImport.myAllocationEmergency(users[i])).to.equal(100);
                tmp = await branchImport.myCurrentAllocation(users[i])
                if (tmp != values[i]) {
                sum += Number(tmp.toString())
                }
            }
        }*/

        unique = users.filter(onlyUnique)

        await branchImport.connect(owner).claim();

        await branchImport.connect(owner).getCommission()

        for(i=0;i<unique.length;i++){
          
          tmp = await branchImport.myCurrentAllocation(unique[i])
          console.log(unique[i], " : ", tmp)
          sum += Number(tmp.toString())
        }

        console.log("For usеrs: ", sum);

        console.log("Branch - ",await token.balanceOf(branchImport.address));
        console.log("Marketing - ",await token.balanceOf(mark.address));
        console.log("Team - ",await token.balanceOf(team.address));
        console.log("MarketingWallet - ",await token.balanceOf(root.address));
  
      });
    });
  });

  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }
  