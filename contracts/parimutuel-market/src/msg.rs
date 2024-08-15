use cosmwasm_std::Addr;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::state::MarketResult;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub fee_bps: u64, // Fee in basis points
    pub denom: String,
    pub id: String,
    pub label: String,
    pub home_team: String,
    pub away_team: String,
    pub start_timestamp: u64,
    pub is_drawable: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    PlaceBet {
        result: MarketResult,
        receiver: Option<Addr>,
    },
    ClaimWinnings {
        receiver: Option<Addr>,
    },
    // Admin
    Update {
        start_timestamp: u64,
    },
    Score {
        result: MarketResult,
    },
    Cancel {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Config {},
    Market {},
    Bets {},
    BetsByAddress {
        address: Addr,
    },
    EstimateWinnings {
        address: Addr,
        result: MarketResult,
    },
}
