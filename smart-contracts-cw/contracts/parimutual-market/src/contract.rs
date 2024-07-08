#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    coin, to_json_binary, Addr, BankMsg, Binary, CosmosMsg, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128,
};
use cw2::set_contract_version;

use crate::{
    calculate_parimutual_winnings,
    error::ContractError,
    msg::{ExecuteMsg, InstantiateMsg, QueryMsg},
    state::{
        Config, Market, MarketResult, Status, CLAIMS, CONFIG, MARKET, POOL_A, POOL_B, TOTAL_A,
        TOTAL_B,
    },
    TotalBets,
};

pub const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

const ADMIN_ADDRESS: &str = "neutron1z7pj2zh928a8rm0ztkx2vfxeyz8txw6g24n795";
const TREASURY_ADDRESS: &str = "neutron12v9pqx602k3rzm5hf4jewepl8na4x89ja4td24";

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, format!("crates.io:{CONTRACT_NAME}"), CONTRACT_VERSION)?;

    let state = Config {
        admin_addr: Addr::unchecked(ADMIN_ADDRESS),
        treasury_addr: Addr::unchecked(TREASURY_ADDRESS),
        fee_bps: msg.fee_bps.clone(),
        denom: msg.denom.clone(),
    };
    CONFIG.save(deps.storage, &state)?;

    let market = Market {
        id: msg.id.clone(),
        sport: msg.sport.clone(),
        tournament: msg.tournament.clone(),
        team_a: msg.team_a.clone(),
        team_b: msg.team_b.clone(),
        start_timestamp: msg.start_timestamp.clone(),
        status: Status::ACTIVE,
        result: None,
    };
    MARKET.save(deps.storage, &market)?;

    TOTAL_A.save(deps.storage, &0)?;
    TOTAL_B.save(deps.storage, &0)?;

    Ok(Response::default())
}

// QUERIES

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => query_config(deps),
        QueryMsg::Market {} => query_market(deps),
        QueryMsg::Bets {} => query_bets(deps),
        QueryMsg::BetsByAddress {
            address,
        } => query_bets_by_address(deps, address),
        QueryMsg::EstimateWinnings {
            address,
            result,
        } => query_estimate_winnings(deps, address, result),
    }
}

fn query_config(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    to_json_binary(&config)
}

fn query_market(deps: Deps) -> StdResult<Binary> {
    let market = MARKET.load(deps.storage)?;
    to_json_binary(&market)
}

fn query_bets(deps: Deps) -> StdResult<Binary> {
    let totals = TotalBets {
        total_a: TOTAL_A.load(deps.storage)?,
        total_b: TOTAL_B.load(deps.storage)?,
    };
    to_json_binary(&totals)
}

fn query_bets_by_address(deps: Deps, address: Addr) -> StdResult<Binary> {
    let total_a = if POOL_A.has(deps.storage, address.clone()) {
        POOL_A.load(deps.storage, address.clone())?
    } else {
        0
    };

    let total_b = if POOL_B.has(deps.storage, address.clone()) {
        POOL_B.load(deps.storage, address.clone())?
    } else {
        0
    };

    let totals = TotalBets {
        total_a,
        total_b,
    };
    to_json_binary(&totals)
}

fn query_estimate_winnings(deps: Deps, address: Addr, result: MarketResult) -> StdResult<Binary> {
    let total_a = TOTAL_A.load(deps.storage)?;
    let total_b = TOTAL_B.load(deps.storage)?;

    let addr_pool_a = if POOL_A.has(deps.storage, address.clone()) {
        POOL_A.load(deps.storage, address.clone())?
    } else {
        0
    };

    let addr_pool_b = if POOL_B.has(deps.storage, address.clone()) {
        POOL_B.load(deps.storage, address.clone())?
    } else {
        0
    };

    let addr_bets = match result {
        MarketResult::A => addr_pool_a,
        MarketResult::B => addr_pool_b,
    };

    let team_bets = match result {
        MarketResult::A => total_a,
        MarketResult::B => total_b,
    };

    let estimate = calculate_parimutual_winnings(total_a + total_b, team_bets, addr_bets);

    to_json_binary(&estimate)
}

// EXECUTE

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::PlaceBet {
            result,
            receiver,
        } => execute_place_bet(deps, env, info, result, receiver),
        ExecuteMsg::ClaimWinnings {
            receiver,
        } => execute_claim_winnings(deps, info, receiver),
        ExecuteMsg::Update {
            start_timestamp,
        } => execute_update(deps, info, start_timestamp),
        ExecuteMsg::Score {
            result,
        } => execute_score(deps, info, result),
        ExecuteMsg::Cancel {} => execute_cancel(deps, info),
    }
}

fn execute_place_bet(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    result: MarketResult,
    receiver: Option<Addr>,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let market = MARKET.load(deps.storage)?;

    let addr = match receiver {
        Some(receiver) => deps.api.addr_validate(receiver.as_str())?,
        None => info.sender.clone(),
    };

    if market.status != Status::ACTIVE {
        return Err(ContractError::MarketNotActive {});
    }

    // Bets are accepted up until 5 minutes before the start of the match
    if market.start_timestamp - 5 * 60 < env.block.time.seconds() {
        return Err(ContractError::BetsNotAccepted {});
    }

    let bet_amount = cw_utils::must_pay(&info, &config.denom);
    if bet_amount.is_err() {
        return Err(ContractError::PaymentError {});
    }
    let bet_amount = bet_amount.unwrap();

    match result {
        MarketResult::A => {
            if !POOL_A.has(deps.storage, addr.clone()) {
                POOL_A.save(deps.storage, addr.clone(), &0)?;
            }

            POOL_A.update(deps.storage, addr.clone(), |pool| -> StdResult<_> {
                Ok(pool.unwrap() + bet_amount.u128())
            })?;
            TOTAL_A
                .update(deps.storage, |total| -> StdResult<_> { Ok(total + bet_amount.u128()) })?
        }
        MarketResult::B => {
            if !POOL_B.has(deps.storage, addr.clone()) {
                POOL_B.save(deps.storage, addr.clone(), &0)?;
            }

            POOL_B.update(deps.storage, addr.clone(), |pool| -> StdResult<_> {
                Ok(pool.unwrap() + bet_amount.u128())
            })?;
            TOTAL_B
                .update(deps.storage, |total| -> StdResult<_> { Ok(total + bet_amount.u128()) })?
        }
    };

    Ok(Response::new()
        .add_attribute("action", "place_bet")
        .add_attribute("sender", info.sender.clone())
        .add_attribute("receiver", addr.clone())
        .add_attribute("bet_amount", bet_amount.to_string())
        .add_attribute("result", result.to_string()))
}

fn execute_claim_winnings(
    deps: DepsMut,
    info: MessageInfo,
    receiver: Option<Addr>,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let market = MARKET.load(deps.storage)?;

    let addr = match receiver {
        Some(receiver) => deps.api.addr_validate(receiver.as_str())?,
        None => info.sender.clone(),
    };

    if market.status == Status::ACTIVE {
        return Err(ContractError::MarketNotClosed {});
    }

    if CLAIMS.has(deps.storage, addr.clone()) {
        return Err(ContractError::ClaimAlreadyMade {});
    }

    let payout;

    let addr_pool_a = if POOL_A.has(deps.storage, addr.clone()) {
        POOL_A.load(deps.storage, addr.clone())?
    } else {
        0
    };

    let addr_pool_b = if POOL_B.has(deps.storage, addr.clone()) {
        POOL_B.load(deps.storage, addr.clone())?
    } else {
        0
    };

    if market.status == Status::CANCELLED {
        payout = addr_pool_a + addr_pool_b;
    } else {
        let bet_amount = match market.result {
            Some(MarketResult::A) => addr_pool_a,
            Some(MarketResult::B) => addr_pool_b,
            None => 0,
        };

        let total_a = TOTAL_A.load(deps.storage)?;
        let total_b = TOTAL_B.load(deps.storage)?;

        let team_bet = match market.result {
            Some(MarketResult::A) => total_a,
            Some(MarketResult::B) => total_b,
            None => 0,
        };

        let winnings = calculate_parimutual_winnings(total_a + total_b, team_bet, bet_amount);
        let mut fee_amount = Uint128::zero();
        if config.fee_bps > 0 {
            fee_amount = Uint128::from(winnings)
                .multiply_ratio(Uint128::from(config.fee_bps), Uint128::from(10000 as u128));
        }
        payout = winnings - fee_amount.u128();
    }

    let mut messages: Vec<CosmosMsg> = vec![];

    if payout > 0 {
        messages.push(
            BankMsg::Send {
                to_address: addr.to_string(),
                amount: vec![coin(payout.into(), config.denom)],
            }
            .into(),
        );
    }

    CLAIMS.save(deps.storage, addr.clone(), &true)?;

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("action", "claim_winnings")
        .add_attribute("sender", info.sender.clone())
        .add_attribute("receiver", addr.clone())
        .add_attribute("payout", payout.to_string()))
}

fn execute_update(
    deps: DepsMut,
    info: MessageInfo,
    start_timestamp: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let market = MARKET.load(deps.storage)?;

    if info.sender != config.admin_addr {
        return Err(ContractError::Unauthorized {});
    }

    if market.status != Status::ACTIVE {
        return Err(ContractError::MarketNotActive {});
    }

    let mut market = MARKET.load(deps.storage)?;
    market.start_timestamp = start_timestamp;

    MARKET.save(deps.storage, &market)?;

    Ok(Response::new()
        .add_attribute("action", "update")
        .add_attribute("sender", info.sender.clone())
        .add_attribute("start_timestamp", start_timestamp.to_string()))
}

fn execute_score(
    deps: DepsMut,
    info: MessageInfo,
    result: MarketResult,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let market = MARKET.load(deps.storage)?;

    if info.sender != config.admin_addr {
        return Err(ContractError::Unauthorized {});
    }

    if market.status != Status::ACTIVE {
        return Err(ContractError::MarketNotActive {});
    }

    let mut market = market;
    market.status = Status::CLOSED;
    market.result = Some(result.clone());
    MARKET.save(deps.storage, &market)?;

    let total_a = TOTAL_A.load(deps.storage)?;
    let total_b = TOTAL_B.load(deps.storage)?;

    let mut fee_amount = Uint128::zero();
    if config.fee_bps > 0 {
        fee_amount = Uint128::from(total_a + total_b)
            .multiply_ratio(Uint128::from(config.fee_bps), Uint128::from(10000 as u128));
    }

    let mut messages: Vec<CosmosMsg> = vec![];

    if fee_amount > Uint128::zero() {
        messages.push(
            BankMsg::Send {
                to_address: config.treasury_addr.to_string(),
                amount: vec![coin(fee_amount.into(), config.denom)],
            }
            .into(),
        );
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("action", "score")
        .add_attribute("sender", info.sender.clone())
        .add_attribute("status", Status::CLOSED.to_string())
        .add_attribute("result", result.clone().to_string())
        .add_attribute("fee_collected", fee_amount.clone()))
}

fn execute_cancel(deps: DepsMut, info: MessageInfo) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let market = MARKET.load(deps.storage)?;

    if info.sender != config.admin_addr {
        return Err(ContractError::Unauthorized {});
    }

    if market.status != Status::ACTIVE {
        return Err(ContractError::MarketNotActive {});
    }

    MARKET.update(deps.storage, |mut market| -> Result<_, ContractError> {
        market.status = Status::CANCELLED;
        Ok(market)
    })?;

    Ok(Response::new()
        .add_attribute("action", "cancel")
        .add_attribute("sender", info.sender.clone())
        .add_attribute("status", Status::CANCELLED.to_string()))
}
