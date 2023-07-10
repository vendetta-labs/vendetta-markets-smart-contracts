// import hre from "hardhat";

// enum GameScore {
//   None = 0,
//   Left = 1,
//   Right = 2,
// }

// async function main() {
//   console.log("Network: ", hre.network.name);

//   const gameMarket = await hre.ethers.getContractAt("GameMarket", "0xC2424aC473E041876EfA9BF54c7F738029E46927");

//   const rewards = await gameMarket.getRewards("0x4b8b39FE23EDdf4827006cb0Aa597856C29A51c1");
//   console.log("My Rewards: ", rewards.toString());
//   // await (await gameMarket.setScore(GameScore.Right)).wait();

//   // console.log(`Score (${GameScore.Right}) set for GameMarket: `, await gameMarket.getAddress());
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
