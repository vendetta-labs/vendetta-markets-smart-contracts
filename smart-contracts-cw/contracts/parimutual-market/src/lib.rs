use cosmwasm_std::Uint128;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub mod contract;
pub mod error;
pub mod msg;
pub mod state;

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct TotalBets {
    pub total_a: u128,
    pub total_b: u128,
}

fn calculate_parimutual_winnings(total_bets: u128, total_team_bets: u128, total_bet: u128) -> u128 {
    if total_bet == 0 || total_team_bets == 0 || total_bets == 0 {
        return 0;
    }

    Uint128::from(total_bets).multiply_ratio(total_bet, total_team_bets).u128()
}
