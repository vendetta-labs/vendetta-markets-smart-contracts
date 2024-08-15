#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    coin, to_json_binary, Addr, BankMsg, Binary, CosmosMsg, Deps, DepsMut, Env, MessageInfo,
    Response, StdResult, Uint128,
};
use cw2::set_contract_version;

use crate::{
    calculate_parimutuel_winnings,
    error::ContractError,
    msg::{ExecuteMsg, InstantiateMsg, QueryMsg},
    state::{
        Config, Market, MarketResult, Status, CLAIMS, CONFIG, MARKET, POOL_AWAY, POOL_DRAW,
        POOL_HOME, TOTAL_AWAY, TOTAL_DRAW, TOTAL_HOME,
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
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    if Addr::unchecked(ADMIN_ADDRESS) != info.sender {
        return Err(ContractError::Unauthorized {});
    }

    // set_contract_version(deps.storage, format!("crates.io:{CONTRACT_NAME}"), CONTRACT_VERSION)?;
    set_contract_version(deps.storage, format!("crates.io:{CONTRACT_NAME}"), CONTRACT_VERSION)?;

    let state = Config {
        admin_addr: Addr::unchecked(ADMIN_ADDRESS),
        treasury_addr: Addr::unchecked(TREASURY_ADDRESS),
        fee_bps: msg.fee_bps,
        denom: msg.denom,
    };
    CONFIG.save(deps.storage, &state)?;

    let market = Market {
        id: msg.id,
        label: msg.label,
        home_team: msg.home_team,
        away_team: msg.away_team,
        start_timestamp: msg.start_timestamp,
        status: Status::ACTIVE,
        result: None,
        is_drawable: msg.is_drawable,
    };
    MARKET.save(deps.storage, &market)?;

    TOTAL_HOME.save(deps.storage, &0)?;
    TOTAL_AWAY.save(deps.storage, &0)?;
    TOTAL_DRAW.save(deps.storage, &0)?;

    Ok(Response::new()
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "create_market")
        .add_attribute("sender", info.sender)
        .add_attribute("id", market.id)
        .add_attribute("label", market.label)
        .add_attribute("home_team", market.home_team)
        .add_attribute("away_team", market.away_team)
        .add_attribute("start_timestamp", market.start_timestamp.to_string())
        .add_attribute("status", Status::ACTIVE.to_string()))
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
        total_home: TOTAL_HOME.load(deps.storage)?,
        total_away: TOTAL_AWAY.load(deps.storage)?,
        total_draw: TOTAL_DRAW.load(deps.storage)?,
    };
    to_json_binary(&totals)
}

fn query_bets_by_address(deps: Deps, address: Addr) -> StdResult<Binary> {
    let total_home = if POOL_HOME.has(deps.storage, address.clone()) {
        POOL_HOME.load(deps.storage, address.clone())?
    } else {
        0
    };

    let total_away = if POOL_AWAY.has(deps.storage, address.clone()) {
        POOL_AWAY.load(deps.storage, address.clone())?
    } else {
        0
    };

    let total_draw = if POOL_DRAW.has(deps.storage, address.clone()) {
        POOL_DRAW.load(deps.storage, address)?
    } else {
        0
    };

    let totals = TotalBets {
        total_home,
        total_away,
        total_draw,
    };
    to_json_binary(&totals)
}

fn query_estimate_winnings(deps: Deps, address: Addr, result: MarketResult) -> StdResult<Binary> {
    let total_home = TOTAL_HOME.load(deps.storage)?;
    let total_away = TOTAL_AWAY.load(deps.storage)?;
    let total_draw = TOTAL_DRAW.load(deps.storage)?;

    let addr_pool_home = if POOL_HOME.has(deps.storage, address.clone()) {
        POOL_HOME.load(deps.storage, address.clone())?
    } else {
        0
    };

    let addr_pool_away = if POOL_AWAY.has(deps.storage, address.clone()) {
        POOL_AWAY.load(deps.storage, address.clone())?
    } else {
        0
    };

    let addr_pool_draw = if POOL_DRAW.has(deps.storage, address.clone()) {
        POOL_DRAW.load(deps.storage, address)?
    } else {
        0
    };

    let addr_bets = match result {
        MarketResult::HOME => addr_pool_home,
        MarketResult::AWAY => addr_pool_away,
        MarketResult::DRAW => addr_pool_draw,
    };

    let team_bets = match result {
        MarketResult::HOME => total_home,
        MarketResult::AWAY => total_away,
        MarketResult::DRAW => total_draw,
    };

    let estimate =
        calculate_parimutuel_winnings(total_home + total_away + total_draw, team_bets, addr_bets);

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

    if !market.is_drawable && result == MarketResult::DRAW {
        return Err(ContractError::MarketNotDrawable {});
    }

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
        MarketResult::HOME => {
            if !POOL_HOME.has(deps.storage, addr.clone()) {
                POOL_HOME.save(deps.storage, addr.clone(), &0)?;
            }

            POOL_HOME.update(deps.storage, addr.clone(), |pool| -> StdResult<_> {
                Ok(pool.unwrap() + bet_amount.u128())
            })?;
            TOTAL_HOME
                .update(deps.storage, |total| -> StdResult<_> { Ok(total + bet_amount.u128()) })?
        }
        MarketResult::AWAY => {
            if !POOL_AWAY.has(deps.storage, addr.clone()) {
                POOL_AWAY.save(deps.storage, addr.clone(), &0)?;
            }

            POOL_AWAY.update(deps.storage, addr.clone(), |pool| -> StdResult<_> {
                Ok(pool.unwrap() + bet_amount.u128())
            })?;
            TOTAL_AWAY
                .update(deps.storage, |total| -> StdResult<_> { Ok(total + bet_amount.u128()) })?
        }
        MarketResult::DRAW => {
            if !POOL_DRAW.has(deps.storage, addr.clone()) {
                POOL_DRAW.save(deps.storage, addr.clone(), &0)?;
            }

            POOL_DRAW.update(deps.storage, addr.clone(), |pool| -> StdResult<_> {
                Ok(pool.unwrap() + bet_amount.u128())
            })?;
            TOTAL_DRAW
                .update(deps.storage, |total| -> StdResult<_> { Ok(total + bet_amount.u128()) })?
        }
    };

    Ok(Response::new()
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "place_bet")
        .add_attribute("sender", info.sender)
        .add_attribute("receiver", addr)
        .add_attribute("bet_amount", bet_amount.to_string())
        .add_attribute("result", result.to_string())
        .add_attribute("total_home", TOTAL_HOME.load(deps.storage)?.to_string())
        .add_attribute("total_away", TOTAL_AWAY.load(deps.storage)?.to_string())
        .add_attribute("total_draw", TOTAL_DRAW.load(deps.storage)?.to_string()))
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

    let addr_pool_home = if POOL_HOME.has(deps.storage, addr.clone()) {
        POOL_HOME.load(deps.storage, addr.clone())?
    } else {
        0
    };

    let addr_pool_away = if POOL_AWAY.has(deps.storage, addr.clone()) {
        POOL_AWAY.load(deps.storage, addr.clone())?
    } else {
        0
    };

    let addr_pool_draw = if POOL_DRAW.has(deps.storage, addr.clone()) {
        POOL_DRAW.load(deps.storage, addr.clone())?
    } else {
        0
    };

    if market.status == Status::CANCELLED {
        payout = addr_pool_home + addr_pool_away + addr_pool_draw;
    } else {
        let bet_amount = match market.result {
            Some(MarketResult::HOME) => addr_pool_home,
            Some(MarketResult::AWAY) => addr_pool_away,
            Some(MarketResult::DRAW) => addr_pool_draw,
            None => 0,
        };

        let total_home = TOTAL_HOME.load(deps.storage)?;
        let total_away = TOTAL_AWAY.load(deps.storage)?;
        let total_draw = TOTAL_DRAW.load(deps.storage)?;

        let team_bets = match market.result {
            Some(MarketResult::HOME) => total_home,
            Some(MarketResult::AWAY) => total_away,
            Some(MarketResult::DRAW) => total_draw,
            None => 0,
        };

        let winnings = calculate_parimutuel_winnings(
            total_home + total_away + total_draw,
            team_bets,
            bet_amount,
        );
        let mut fee_amount = Uint128::zero();
        if config.fee_bps > 0 {
            fee_amount = Uint128::from(winnings)
                .multiply_ratio(Uint128::from(config.fee_bps), Uint128::from(10000_u128));
        }
        payout = winnings - fee_amount.u128();
    }

    let mut messages: Vec<CosmosMsg> = vec![];

    if payout > 0 {
        messages.push(
            BankMsg::Send {
                to_address: addr.to_string(),
                amount: vec![coin(payout, config.denom)],
            }
            .into(),
        );
    } else {
        return Err(ContractError::NoWinnings {});
    }

    CLAIMS.save(deps.storage, addr.clone(), &true)?;

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "claim_winnings")
        .add_attribute("sender", info.sender)
        .add_attribute("receiver", addr)
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
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "update_market")
        .add_attribute("sender", info.sender)
        .add_attribute("start_timestamp", start_timestamp.to_string())
        .add_attribute("total_home", TOTAL_HOME.load(deps.storage)?.to_string())
        .add_attribute("total_away", TOTAL_AWAY.load(deps.storage)?.to_string())
        .add_attribute("total_draw", TOTAL_DRAW.load(deps.storage)?.to_string()))
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

    if !market.is_drawable && result == MarketResult::DRAW {
        return Err(ContractError::MarketNotDrawable {});
    }

    if market.status != Status::ACTIVE {
        return Err(ContractError::MarketNotActive {});
    }

    let mut market = market;
    market.status = Status::CLOSED;
    market.result = Some(result.clone());
    MARKET.save(deps.storage, &market)?;

    let total_home = TOTAL_HOME.load(deps.storage)?;
    let total_away = TOTAL_AWAY.load(deps.storage)?;
    let total_draw = TOTAL_DRAW.load(deps.storage)?;

    let winning_side = match result {
        MarketResult::HOME => total_home,
        MarketResult::AWAY => total_away,
        MarketResult::DRAW => total_draw,
    };

    let losing_side = match result {
        MarketResult::HOME => total_away + total_draw,
        MarketResult::AWAY => total_home + total_draw,
        MarketResult::DRAW => total_home + total_away,
    };

    if winning_side <= 0 || losing_side <= 0 {
        return Err(ContractError::NoWinnings {});
    }

    let mut fee_amount = Uint128::zero();
    if config.fee_bps > 0 {
        fee_amount = Uint128::from(total_home + total_away + total_draw)
            .multiply_ratio(Uint128::from(config.fee_bps), Uint128::from(10000_u128));
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
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "score_market")
        .add_attribute("sender", info.sender)
        .add_attribute("status", Status::CLOSED.to_string())
        .add_attribute("result", result.to_string())
        .add_attribute("fee_collected", fee_amount)
        .add_attribute("total_home", total_home.to_string())
        .add_attribute("total_away", total_away.to_string())
        .add_attribute("total_draw", total_draw.to_string()))
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
        .add_attribute("protocol", "vendetta-markets")
        .add_attribute("market_type", "parimutuel")
        .add_attribute("action", "cancel_market")
        .add_attribute("sender", info.sender)
        .add_attribute("status", Status::CANCELLED.to_string())
        .add_attribute("total_home", TOTAL_HOME.load(deps.storage)?.to_string())
        .add_attribute("total_away", TOTAL_AWAY.load(deps.storage)?.to_string())
        .add_attribute("total_draw", TOTAL_DRAW.load(deps.storage)?.to_string()))
}
