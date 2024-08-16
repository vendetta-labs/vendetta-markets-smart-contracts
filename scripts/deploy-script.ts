import { getAccountByName } from "@kubiklabs/wasmkit";

import { VendettaMarketsParimutuelMarketContract } from "../artifacts/typescript_schema/VendettaMarketsParimutuelMarketContract";

export default async function run() {
  const contract_owner = await getAccountByName("account_0");
  const parimutuel_contract = new VendettaMarketsParimutuelMarketContract();
  await parimutuel_contract.setupClient();

  const deploy_response = await parimutuel_contract.deploy(contract_owner);
  console.log(deploy_response);

  const contract_info = await parimutuel_contract.instantiate(
    {
      denom: "untrn",
      fee_bps: 250, // 2.5%
      id: "game-cs2-test-league",
      label: "CS2 - Test League - Team A vs Team B",
      home_team: "Team A",
      away_team: "Team B",
      start_timestamp:
        Number((new Date().getTime() / 1000).toFixed(0)) + 60 * 10, // 10 minutes from now
      is_drawable: true,
    },
    `Vendetta Markets - Parimutuel Market v2.0.0 - Drawable`,
    contract_owner
  );
  console.log(contract_info);

  // const contract_info = await parimutuel_contract.instantiate(
  //   {
  //     denom: "untrn",
  //     fee_bps: 250, // 2.5%
  //     id: "game-cs2-final",
  //     label: "CS2 - Final - Home Team vs Away Team",
  //     home_team: "Home Team",
  //     away_team: "Away Team",
  //     start_timestamp:
  //       Number((new Date().getTime() / 1000).toFixed(0)) + 60 * 10, // 10 minutes from now
  //     is_drawable: false,
  //   },
  //   `Vendetta Markets - Parimutuel Market v2.0.0 - Non-Drawable`,
  //   contract_owner
  // );
  // console.log(contract_info);
}
