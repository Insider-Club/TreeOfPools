# Tree Of Pools

Tree Of Pools allows you to create crowdfunding pools, with a single access address.

This project was created and is being improved by the Insider Club team. But we would be glad if you could join us and help us create a safe and open crowdfunding system.

If you would like to contact us, please write to hello@myinsider.club
## Overview

### Installation

> Note: Git is required. Please install with [GIT](https://github.com/git-guides/install-git).

First, you need to clone this github repository.

```bash
git clone https://github.com/Insider-Club/TreeOfPools
cd TreeOfPools
```

Now let's set the necessary packages for the corrective work hardhat.

> Note: NodeJS 14+ is required. Please install with [NVM](https://nvm.sh).

```bash
npm install
```

Wait a bit, it might take a while to load all the necessary pokets :\

Now you are almost ready to use TreeOfPools.

#### Setting up personal data

To use scripts, you need to specify a private key in the configuration file.
Create an env.json file with the following format:

```json
{
    "PK": "<your private key>"
}
```

> Note: Here you can also specify etherscan API keys for automatic verification of contracts. (These API keys will need to be reconciled with the hardhat configuration file). You can learn more about hardhat configuration [here](https://hardhat.org/config).

Congratulations! You have installed everything you need. Now all that is left is to compile the project hardhat.

```bash
npx hardhat compile --force
```

### Usage

#### Deploy

Let's run the script

```bash
npx hardhat run --network <testbsc/bsc/eth/polygon/moonbeam> scripts/deploy.js
```

network - allows you to select the parameterization of the network from the hardhat configuration file. 

When the script finishes, it will display all of the contract addresses in the console

#### Update

If you already have a contract on the network, but you need to update its logic. You can use the update script
This script will compile the current version of the contract and update the logic of the existing one.

> Note: This is only possible if an existing contract has been deployed with your private key.

```bash
npx hardhat run --network <testbsc/bsc/eth/polygon/moonbeam> scripts/update.js
```

The script will ask you for the proxy address you want to update.

#### Import/Export

> Note: You can use this functionality to transfer user information between networks.

To transfer information about the shares of crowdfunding participants, you can use the appropriate scripts.

```bash
npx hardhat run --network <testbsc/bsc/eth/polygon/moonbeam> scripts/exportData.js
```
This script collects all the necessary information and saves it to the usersData.json file.

To import this information into a contract, use this script

```bash
npx hardhat run --network <testbsc/bsc/eth/polygon/moonbeam> scripts/importData.js
```

> Important: You must have TreeOfPools instances in both networks in order to pass information between networks correctly.

#### Verify

> Note: In order to verify contracts you need to have etherscan API keys. You can get them in your personal etherscan [account](https://etherscan.io/login).

Now to verify the contract you just need to specify the network and contract address

```bash
npx hardhat verify --network <testbsc/bsc/eth/polygon/moonbeam> <address>
```

#### Verification of contracts using proxies

In order to verify a contract behind a proxy you must:
1. Verify the contract which implements the logic
2. Specify to etherscan that this is a proxy contract

## License

Tree Of Pools Contracts is released under the [GPL-3.0 license](https://github.com/Insider-Club/TreeOfPools/blob/main/LICENSE) .
