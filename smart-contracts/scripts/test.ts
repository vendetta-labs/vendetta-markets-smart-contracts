// import hre from "hardhat";

// enum GameScore {
//   None = 0,
//   Left = 1,
//   Right = 2,
// }

// async function main() {
//   console.log("Network: ", hre.network.name);

//   const account = await hre.ethers.provider.getSigner();

//   const testnetUSDC = "0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E";
//   const gameMarketAddress = "0xC2424aC473E041876EfA9BF54c7F738029E46927";

//   const usdc = await hre.ethers.getContractAt("ERC20", testnetUSDC);
//   const gameMarket = await hre.ethers.getContractAt("GameMarket", gameMarketAddress);

//   console.log("Account: ", await account.getAddress());
//   console.log(
//     "Account ETH Balance: ",
//     hre.ethers.formatEther(await hre.ethers.provider.getBalance(await account.getAddress()))
//   );
//   console.log(
//     "Account USDC Balance: ",
//     hre.ethers.formatUnits(await usdc.balanceOf(account.getAddress()), await usdc.decimals())
//   );

//   await (
//     await usdc.connect(account).increaseAllowance(gameMarketAddress, hre.ethers.parseUnits("1", await usdc.decimals()))
//   ).wait();

//   const tx = await gameMarket.connect(account).bet(hre.ethers.parseUnits("1", await usdc.decimals()), GameScore.Left);
//   await tx.wait();

//   console.log("Bet Transaction: ", tx.hash);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
