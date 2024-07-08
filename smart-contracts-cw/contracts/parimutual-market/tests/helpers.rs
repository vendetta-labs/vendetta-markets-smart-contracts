#![allow(dead_code)]

use cosmwasm_std::{
    from_binary,
    testing::{
        mock_dependencies_with_balance, mock_env, mock_info, MockApi, MockQuerier, MockStorage,
    },
    Deps, OwnedDeps,
};
use vendetta_markets_parimutual_market::{contract::query, msg::QueryMsg};

pub fn th_setup() -> OwnedDeps<MockStorage, MockApi, MockQuerier> {
    let mut deps = mock_dependencies_with_balance(&[]);

    // instantiate(
    //     deps.as_mut(),
    //     mock_env(),
    //     mock_info("deployer", &[]),
    //     InstantiateMsg {
    //         owner: "sei_owner".to_string(),
    //         prefix: "sei".to_string(),
    //     },
    // )
    // .unwrap();

    deps
}

pub fn th_query<T: serde::de::DeserializeOwned>(deps: Deps, msg: QueryMsg) -> T {
    from_binary(&query(deps, mock_env(), msg).unwrap()).unwrap()
}
