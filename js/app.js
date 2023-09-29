// Get references to HTML elements
const connectButton = document.getElementById("connect-wallet-button");
const accountInfo = document.getElementById("account-info");
const networkInfo = document.getElementById("network-info");
const form = document.getElementById("bet-form");

const tokenAddress = "0x9828a5ae9b83a56d20576bf8a53bed6259b731c1";
const DEFAULT_ORACLE_ADDRESS = "0x0000000000000000000000000000000000000000";

let tokenABI, tokenContract;
let provider, signer, account;
let betIds = [];

// Attach click event listener to the connect button
connectButton.addEventListener("click", connectToWallet);

// Asynchronously connect to wallet when the connect button is clicked
async function connectToWallet() {
  // Check if the browser has Ethereum provider injected
  if (typeof window.ethereum === "undefined") {
    console.log("Wallet is not installed!");
    return;
  }

  try {
    // Create an ethers.js provider instance
    provider = null;
    provider = await new ethers.BrowserProvider(window.ethereum);

    // Get the signer from the provider
    signer = await provider.getSigner();
    // Get the connected account address from the signer
    account = await signer.getAddress();

    // If no account is connected, log a message to the console
    if (!account) {
      console.log("Please connect to Wallet.");
      return;
    }

    // Handle the connected account
    handleAccountsChanged(account.toLowerCase());

    // Get the network chainId and handle it
    const chainId = await provider
      .getNetwork()
      .then((network) => network.chainId);
    if (chainId != null) {
      handleChainChanged(Number(chainId));
    } else {
      console.log("Connected, but chainId is null!");
    }

    tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);
    await loadContractInfo(signer); //

    // Error out if initialization fails
  } catch (error) {
    console.error(error);
  }
}

// Function to load ABI and initialize contract instance
async function loadContractInfo(connectedTo) {
  if (!tokenABI) {
    tokenABI = await loadABI("TestingBettingExchangeToken.json");
  }

  if (!tokenContract) {
    tokenContract = new ethers.Contract(tokenAddress, tokenABI, connectedTo);
  }

  try {
    const tokenSymbol = await tokenContract.symbol();
  } catch (error) {
    console.error("Error fetching token symbol:", error);
  }

  try {
    const tokenDecimals = await tokenContract.decimals();
  } catch (error) {
    console.error("Error fetching token decimals:", error);
  }

  try {
    await populateUserBalance();
  } catch {
    console.error("Error populating BET balance:", error);
  }

  try {
    const bets = await fetchAvailableBets();
    betIds = [];
    for (let i = 0; i < bets.length; i++) {
      betIds.push(Number(bets[i]));
    }
  } catch (error) {
    console.error("Error fetching available bets:", error);
  }

  try {
    await populateAvailableBetsMarket();
  } catch {
    console.error("Error populating availiable bets:", error);
  }

  try {
    await populateUserActiveBets();
  } catch {
    console.error("Error populating user active bets:", error);
  }

  try {
    await populateUserPendingBets();
  } catch {
    console.error("Error populating user pending bets:", error);
  }

  try {
    await populateUserPastBets();
  } catch {
    console.error("Error populating user past bets:", error);
  }
}

async function populateUserBalance() {
  if (account && tokenContract) {
    // Check if account is defined and tokenContract is initialized
    try {
      const balance = await tokenContract.balanceOf(account);
      const balanceElement = document.getElementById("bet-balance");
      balanceElement.textContent = `Balance: ${formatTokenAmount(balance)}`;
    } catch (error) {
      console.error("Error updating user balance:", error);
    }
  } else {
    const balanceElement = document.getElementById("bet-balance");
    balanceElement.textContent = `Connect Wallet to view Balance`;
  }
}

async function populateAvailableBetsMarket() {
  const betsContainer = document.getElementById("available-bets");
  betsContainer.innerHTML = ""; // Clear existing rows.

  try {
    const betIds = await tokenContract.getAvailableBets();
    const betsDetails = await Promise.all(
      betIds.map((betId) => tokenContract.readBet(betId))
    );

    if (betsDetails.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "No available bets to display.";
      cell.colSpan = 6;
      row.appendChild(cell);
      betsContainer.appendChild(row);
      return;
    }

    betsDetails.forEach((betDetail, index) => {
      const { alice, amount, oracle } = betDetail;
      const truncatedAlice = truncateAddress(alice);
      const formattedAmount = formatTokenAmount(amount);
      const truncatedOracle = truncateAddress(oracle);
      const payoutAmount = BigInt(amount) * 2n;
      const formattedPayoutAmount = formatTokenAmount(payoutAmount.toString());

      const row = document.createElement("tr");
      const id = betIds[index];

      // Creating cells for Bet ID, Stake, Maker, Oracle, and Payout, and appending them to the row
      [
        id,
        formattedAmount,
        truncatedAlice,
        truncatedOracle,
        formattedPayoutAmount,
      ].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      // Creating a cell for Actions and appending to the row
      const actionCell = document.createElement("td");
      const takeBetButton = document.createElement("button");
      takeBetButton.textContent = "Take Bet";
      takeBetButton.dataset.betId = id;

      takeBetButton.addEventListener("click", async () => {
        try {
          // Calling the acceptBet function of the contract with the associated betId.
          await tokenContract.acceptBet(id);
          // Repopulating the available bets after the bet has been taken.
          populateAvailableBetsMarket();
        } catch (error) {
          console.error("Error taking bet:", error);
        }
      });

      actionCell.appendChild(takeBetButton);
      row.appendChild(actionCell);
      betsContainer.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching bet details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error loading available bets.";
    errorCell.colSpan = 6;
    errorRow.appendChild(errorCell);
    betsContainer.appendChild(errorRow);
  }
}

async function populateUserActiveBets() {
  const activeBetsContainer = document.getElementById("active-bets");
  activeBetsContainer.innerHTML = ""; // Clear any previously added rows.

  if (!account) {
    const connectWalletRow = document.createElement("tr");
    const connectWalletCell = document.createElement("td");
    connectWalletCell.textContent = "Connect wallet to view your active bets.";
    connectWalletCell.colSpan = 5;
    connectWalletRow.appendChild(connectWalletCell);
    activeBetsContainer.appendChild(connectWalletRow);
    return;
  }

  try {
    const activeBets = await tokenContract.getActiveBetsForUser(account);
    if (activeBets.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "No active bets to display.";
      cell.colSpan = 5;
      row.appendChild(cell);
      activeBetsContainer.appendChild(row);
      return;
    }

    for (const betId of activeBets) {
      const betDetail = await tokenContract.readBet(betId);
      const { alice, amount, oracle } = betDetail;
      const truncatedAlice = truncateAddress(alice);
      const formattedAmount = formatTokenAmount(amount);
      const truncatedOracle = truncateAddress(oracle);
      const payoutAmount = BigInt(amount) * 2n;
      const formattedPayoutAmount = formatTokenAmount(payoutAmount.toString());

      const row = document.createElement("tr");
      [
        betId,
        formattedAmount,
        truncatedAlice,
        truncatedOracle,
        formattedPayoutAmount,
      ].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      activeBetsContainer.appendChild(row);
    }
  } catch (error) {
    console.error("Error fetching active bets details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error fetching active bets.";
    errorCell.colSpan = 5;
    errorRow.appendChild(errorCell);
    activeBetsContainer.appendChild(errorRow);
  }
}

async function populateUserPendingBets() {
  const userBetsContainer = document.getElementById("user-bets");
  userBetsContainer.innerHTML = ""; // Clear existing rows.

  if (!account) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = "Connect wallet to view your pending bets.";
    cell.colSpan = 6;
    row.appendChild(cell);
    userBetsContainer.appendChild(row);
    return;
  }

  try {
    const userBets = await tokenContract.getOpenBetsForUser(account);

    if (userBets.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "You have no pending bets.";
      cell.colSpan = 6;
      row.appendChild(cell);
      userBetsContainer.appendChild(row);
      return;
    }

    for (const betId of userBets) {
      const betDetail = await tokenContract.readBet(betId);
      const { alice, amount, oracle } = betDetail;
      const formattedAmount = formatTokenAmount(amount); // Ensure formatTokenAmount function is defined and imported properly.
      const truncatedOracle = truncateAddress(oracle);
      const payoutAmount = BigInt(amount) * 2n;
      const formattedPayoutAmount = formatTokenAmount(payoutAmount.toString());

      const row = document.createElement("tr");
      [betId, formattedAmount, truncatedOracle, formattedPayoutAmount].forEach(
        (data) => {
          const td = document.createElement("td");
          td.textContent = data;
          row.appendChild(td);
        }
      );

      // Creating "Update Oracle" Button
      const updateCell = document.createElement("td");
      const updateButton = document.createElement("button");
      updateButton.textContent = "Update";
      updateButton.className = "action-button";
      updateButton.dataset.action = "updateOracle";
      updateButton.dataset.betId = betId;
      updateCell.appendChild(updateButton);
      row.appendChild(updateCell);

      // Creating "Cancel" Button
      const cancelCell = document.createElement("td");
      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";
      cancelButton.className = "action-button";
      cancelButton.dataset.action = "cancelBet";
      cancelButton.dataset.betId = betId;
      cancelCell.appendChild(cancelButton);
      row.appendChild(cancelCell);

      userBetsContainer.appendChild(row);
    }
  } catch (error) {
    console.error("Error fetching user bets details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error loading pending bets.";
    errorCell.colSpan = 6;
    errorRow.appendChild(errorCell);
    userBetsContainer.appendChild(errorRow);
  }
}

async function populateUserPastBets() {
  const userPastBetsContainer = document.getElementById("past-bets");
  const noPastBetsRow = document.getElementById("no-past-bets-row");

  while (
    userPastBetsContainer.firstChild &&
    userPastBetsContainer.firstChild !== noPastBetsRow
  ) {
    userPastBetsContainer.removeChild(userPastBetsContainer.firstChild);
  }

  if (!account) {
    return;
  }

  try {
    const [wonBetsIds, lostBetsIds, canceledBetsIds] = await Promise.all([
      tokenContract.getWonBetsForUser(account),
      tokenContract.getLostBetsForUser(account),
      tokenContract.getCanceledBetsForUser(account),
    ]);

    const allBetsIds = [
      ...wonBetsIds.map((id) => ({ id, status: "Won" })),
      ...lostBetsIds.map((id) => ({ id, status: "Lost" })),
      ...canceledBetsIds.map((id) => ({ id, status: "Canceled" })),
    ];

    if (allBetsIds.length === 0) {
      noPastBetsRow.cells[0].textContent = "No past bets to display.";
      return;
    }

    noPastBetsRow.style.display = "none";

    for (const { id, status } of allBetsIds) {
      const betDetail = await tokenContract.readBet(id);
      const { alice, amount, bob, oracle } = betDetail;
      const formattedAmount = formatTokenAmount(amount);
      const truncatedOracle = truncateAddress(oracle);
      let payoutAmount;
      let formattedPayoutAmount;

      if (status === "Won") {
        payoutAmount = BigInt(amount) * 2n; // Example calculation for a won bet.
        formattedPayoutAmount = `+${formatTokenAmount(
          payoutAmount.toString()
        )} BET`;
      } else if (status === "Lost") {
        payoutAmount = BigInt(amount);
        formattedPayoutAmount = `-${formatTokenAmount(
          payoutAmount.toString()
        )} BET`;
      } else {
        // Canceled
        payoutAmount = 0n;
        formattedPayoutAmount = `${formatTokenAmount(
          payoutAmount.toString()
        )} BET`;
      }

      const row = document.createElement("tr");

      [
        id,
        formattedAmount,
        alice,
        bob || "N/A",
        truncatedOracle,
        status,
        formattedPayoutAmount,
      ].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      userPastBetsContainer.appendChild(row);
    }
  } catch (error) {
    console.error("Error fetching user past bets details:", error);
    noPastBetsRow.cells[0].textContent = "Error fetching past bets.";
  }
}

function appendCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
}

async function createBet(betAmount, oracleAddress) {
  try {
    // Convert betAmount to wei or the smallest denomination of your token
    const amount = ethers.parseUnits(betAmount, "ether"); // or 'wei' if the amount is in wei
    console.log(amount);
    console.log(tokenContract);

    // Assuming your smart contract has a function named `createBet` that takes betAmount and oracleAddress as parameters
    // Adjust accordingly to match your smart contract function's name and parameters
    const tx = await tokenContract.createBet(amount, oracleAddress);

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    // Log the transaction receipt
    console.log("Transaction Receipt:", receipt);

    await loadContractInfo(signer);

    // Optionally, update UI elements here to reflect the creation of the new bet
  } catch (error) {
    console.error("Error creating bet:", error);
    // Handle the error appropriately in your UI
  }
}

async function loadABI(filename) {
  try {
    const response = await fetch(`./abis/${filename}`);
    if (!response.ok) {
      throw Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`Error loading ABI: ${filename}`, error);
    throw error; // rethrowing the error after logging it, so it can be handled by the caller if needed
  }
}

async function fetchAvailableBets() {
  const bets = await tokenContract.getAvailableBets();
  return bets;
}

// Function to handle changes in connected accounts
function handleAccountsChanged(account) {
  // If no account is connected, update the accountInfo text content
  if (!account) {
    console.log("Please connect to Wallet.");
    accountInfo.textContent = "Not connected";
    return;
  }

  // Update the accountInfo text content
  const checksumAddress = ethers.getAddress(account);
  accountInfo.textContent = `Connected: ${checksumAddress}`;
}

// Function to handle changes in the network chainId
function handleChainChanged(chainId) {
  // Update the networkInfo text content
  networkInfo.textContent = `Network: ${getNetworkName(chainId)}`;
}

// Function to get the name of the network based on the chainId
function getNetworkName(chainId) {
  // Return the corresponding network name for the given chainId
  switch (chainId) {
    case 1:
      return "Ethereum Mainnet";
    case 31:
      return "RSK Testnet";
    default:
      return "Unknown Network";
  }
}

// Function to truncate an address
function truncateAddress(address) {
  return address.length > 13
    ? address.substring(0, 6) + "..." + address.substring(address.length - 4)
    : address;
}

function formatWeiToEther(wei) {
  return ethers.formatEther(wei);
}

function formatTokenAmount(amountInWei) {
  const formatted = parseFloat(ethers.formatUnits(amountInWei, 18));
  if (Number.isInteger(formatted)) {
    return formatted + " TBET"; // if whole number, no decimal places
  } else {
    const str = formatted.toString();
    const decimalPart = str.split(".")[1];
    let truncated = decimalPart;
    for (let i = decimalPart.length - 1; i >= 0; i--) {
      if (decimalPart[i] !== "0") {
        truncated = decimalPart.substring(0, i + 1);
        break;
      }
    }
    return str.split(".")[0] + "." + truncated + " TBET"; // display with the lowest amount of decimal places
  }
}

// Attach listeners if wallet is detected and provide fallback provider if none is detected
if (typeof window.ethereum !== "undefined") {
  provider = new ethers.BrowserProvider(window.ethereum);
  // Listener for changes in the connected account
  window.ethereum.on("accountsChanged", async function (accounts) {
    if (accounts.length === 0) {
      console.log("Please connect to Wallet.");
      accountInfo.textContent = "Not connected";
      tokenContract = null; // clear the contract instance as no account is connected
    } else {
      handleAccountsChanged(accounts[0]);
      try {
        console.log(provider);
        provider = new ethers.BrowserProvider(window.ethereum);
        console.log(provider);

        signer = await provider.getSigner(); // get the new signer
        tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer); // create a new contract instance with the new signer
        loadContractInfo(signer);
      } catch (error) {
        console.error(
          "Error creating a new contract instance with the new signer:",
          error
        );
      }
    }
  });

  // Listener for changes in the connected network
  window.ethereum.on("chainChanged", function (chainId) {
    console.log(chainId);
    const decimalChainId = parseInt(chainId, 16);
    handleChainChanged(decimalChainId);
  });
} else {
  provider = new ethers.JsonRpcProvider("https://public-node.testnet.rsk.co/");
}

// Create Bet form event listener
form.addEventListener("submit", async function (e) {
  e.preventDefault(); // prevents the default form submission behavior

  const betAmount = document.getElementById("bet-amount").value;
  let oracleAddress = document.getElementById("oracle-address").value || null; // or a default address if needed

  if (!oracleAddress) {
    oracleAddress = DEFAULT_ORACLE_ADDRESS; // if oracleAddress is blank, set it to the default oracle address
  }

  // Call the function to interact with the smart contract
  await createBet(betAmount, oracleAddress);
});

loadContractInfo(provider); // load contract info on page load with the read-only provider if MetaMask is not installed.
