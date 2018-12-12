# Smart contracts for Fantasy Football Chain app

There are 2 smart contracts: `FantasyFootballChain` for managing squads and `TicketSystem` for managing support messages that come from players.

How to deploy
-------------
Create `env.js` file in the project root and set environment variables:
```
module.exports = {
	ORACLE_ADDRESS: "", // address that validates squads
	PLATFORM_FEE_ADDRESS: "", // fee address
	PLATFORM_FEE_RATE: 1000 // fee rate, 10000 == 100%
};
```

How to run tests
----------------
```
npm run test
```

License
----
GNU GPLv3
