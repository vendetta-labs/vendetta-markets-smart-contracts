import { getAccountByName } from "@kubiklabs/wasmkit";

import { VendettaMarketsParimutuelMarketContract } from "../artifacts/typescript_schema/VendettaMarketsParimutuelMarketContract";

export default async function run() {
  const account_3 = await getAccountByName("account_3");

  const contract_owner = await getAccountByName("account_0");
  const parimutuel_contract = new VendettaMarketsParimutuelMarketContract();
  await parimutuel_contract.setupClient();

  const deploy_response = await parimutuel_contract.deploy(contract_owner);
  console.log(deploy_response);

  const contract_info = await parimutuel_contract.instantiate(
    {
      denom: "untrn",
      fee_bps: 250, // 2.5%
      id: "TEST 2",
      label: "League of Legends - EU LCS - Team A vs Team B",
      home_team: "Team A",
      away_team: "Team B",
      start_timestamp: 1751918972,
    },
    `Vendetta Markets - Parimutuel Market v2.0.0`,
    contract_owner
  );
  console.log(contract_info);
}
