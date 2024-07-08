use cosmwasm_std::Addr;
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub const CONFIG: Item<Config> = Item::new("config");
pub const MARKET: Item<Market> = Item::new("market");
pub const POOL_A: Map<Addr, u128> = Map::new("pool_a");
pub const POOL_B: Map<Addr, u128> = Map::new("pool_b");
pub const TOTAL_A: Item<u128> = Item::new("total_a");
pub const TOTAL_B: Item<u128> = Item::new("total_b");
pub const CLAIMS: Map<Addr, bool> = Map::new("claims");

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct Config {
    pub admin_addr: Addr,
    pub treasury_addr: Addr,
    pub fee_bps: u64,
    pub denom: String,
}

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
pub enum Status {
    ACTIVE,
    CLOSED,
    CANCELLED,
}

impl Status {
    pub fn to_string(&self) -> String {
        match self {
            Status::ACTIVE => "ACTIVE".to_string(),
            Status::CLOSED => "CLOSED".to_string(),
            Status::CANCELLED => "CANCELLED".to_string(),
        }
    }
}

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
pub enum MarketResult {
    A,
    B,
}

impl MarketResult {
    pub fn to_string(&self) -> String {
        match self {
            MarketResult::A => "A".to_string(),
            MarketResult::B => "B".to_string(),
        }
    }
}

#[derive(Serialize, Debug, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct Market {
    pub id: String,
    pub sport: String,
    pub tournament: String,
    pub team_a: String,
    pub team_b: String,
    pub start_timestamp: u64,
    pub status: Status,
    pub result: Option<MarketResult>,
}
