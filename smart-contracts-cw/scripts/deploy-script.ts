import { getAccountByName } from "@kubiklabs/wasmkit";

import { VendettaMarketsParimutualMarketContract } from "../artifacts/typescript_schema/VendettaMarketsParimutualMarketContract";

export default async function run() {
  const contract_owner = await getAccountByName("account_0");
  const parimutual_contract = new VendettaMarketsParimutualMarketContract();
  await parimutual_contract.setupClient();

  //   const deploy_response = await parimutual_contract.deploy(contract_owner);
  //   console.log(deploy_response);

  const contract_info = await parimutual_contract.instantiate(
    {
      denom: "untrn",
      fee_bps: 250, // 2.5%
      id: "TEST 2",
      sport: "League of Legends",
      tournament: "EU LCS",
      team_a: "Team A",
      team_b: "Team B",
      start_timestamp: 1751918972,
    },
    `Vendetta Markets - Parimutual Market v1.0.0`,
    contract_owner
  );
  console.log(contract_info);
}
