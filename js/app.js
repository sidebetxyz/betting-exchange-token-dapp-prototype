// Get references to HTML elements
const connectButton = document.getElementById("connect-button");
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
      balanceElement.textContent = `Balance: ${ethers.formatUnits(
        balance,
        "ether"
      )} BET`;
    } catch (error) {
      console.error("Error updating user balance:", error);
    }
  } else {
    // You may want to update the balance displayed to '0' or some placeholder when no account is connected.
    const balanceElement = document.getElementById("bet-balance");
    balanceElement.textContent = `Connect Wallet to view Balance`;
  }
}

async function populateAvailableBetsMarket() {
  const betsContainer = document.getElementById("available-bets");
  betsContainer.innerHTML = ""; // Clear existing rows.

  try {
    const betsDetails = await Promise.all(
      betIds.map((betId) => tokenContract.readBet(betId))
    );

    if (betsDetails.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "No available bets to display.";
      cell.colSpan = 5; // Adjust colspan according to the number of columns.
      row.appendChild(cell);
      betsContainer.appendChild(row);
      return;
    }

    betsDetails.forEach((betDetail, index) => {
      const { alice, amount, oracle } = betDetail;
      const truncatedAlice = truncateAddress(alice);
      const formattedAmount = formatWeiToEther(amount);
      const truncatedOracle = truncateAddress(oracle);

      const row = document.createElement("tr");
      const id = betIds[index];

      // Adjusting the order of data to match the new structure.
      [id, formattedAmount, truncatedAlice, truncatedOracle].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      const payoutCell = document.createElement("td");
      payoutCell.textContent = "Payout Placeholder"; // Replace with actual payout if available.
      row.appendChild(payoutCell);

      betsContainer.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching bet details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error loading available bets.";
    errorCell.colSpan = 5; // Adjust colspan according to the number of columns.
    errorRow.appendChild(errorCell);
    betsContainer.appendChild(errorRow);
  }
}

async function populateUserActiveBets() {
  const activeBetsContainer = document.getElementById("active-bets");

  // Clear any previously added rows except for the default one.
  while (activeBetsContainer.firstChild) {
    activeBetsContainer.removeChild(activeBetsContainer.firstChild);
  }

  // If the wallet is not connected
  if (!account) {
    const connectWalletRow = document.createElement("tr");
    const connectWalletCell = document.createElement("td");
    connectWalletCell.textContent = "Connect wallet to view your active bets.";
    connectWalletCell.colSpan = 5; // Adjusted to match the number of columns in your table.
    connectWalletRow.appendChild(connectWalletCell);
    activeBetsContainer.appendChild(connectWalletRow);
    return;
  }

  try {
    const activeBets = await tokenContract.getActiveBetsForUser(account);

    // If there are no active bets
    if (activeBets.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "No active bets to display.";
      cell.colSpan = 5; // Adjusted to match the number of columns in your table.
      row.appendChild(cell);
      activeBetsContainer.appendChild(row);
      return;
    }

    // If there are active bets
    activeBets.forEach(async (betId) => {
      const betDetail = await tokenContract.readBet(betId);
      const { alice, amount, oracle } = betDetail;
      const truncatedAlice = truncateAddress(alice);
      const formattedAmount = formatWeiToEther(amount);
      const truncatedOracle = truncateAddress(oracle);

      const row = document.createElement("tr");

      [betId, formattedAmount, truncatedAlice, truncatedOracle].forEach(
        (data) => {
          const td = document.createElement("td");
          td.textContent = data;
          row.appendChild(td);
        }
      );

      const payoutCell = document.createElement("td");
      payoutCell.textContent = "Payout Placeholder"; // To be replaced with actual payout calculation.
      row.appendChild(payoutCell);

      activeBetsContainer.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching active bets details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error fetching active bets.";
    errorCell.colSpan = 5; // Adjusted to match the number of columns in your table.
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
    cell.colSpan = 5; // Adjust colspan according to the number of columns.
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
      cell.colSpan = 5;
      row.appendChild(cell);
      userBetsContainer.appendChild(row);
      return;
    }

    userBets.forEach(async (betId) => {
      const betDetail = await tokenContract.readBet(betId);
      const { alice, amount, oracle } = betDetail;
      const formattedAmount = formatWeiToEther(amount);
      const truncatedOracle = truncateAddress(oracle);

      const row = document.createElement("tr");

      // Creating cells for Bet ID, Stake, Oracle and appending them to the row
      [betId, formattedAmount, truncatedOracle].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      // Creating a cell for Payout and appending to the row
      const payoutCell = document.createElement("td");
      payoutCell.textContent = "Payout Placeholder";
      row.appendChild(payoutCell);

      // Creating a cell for Actions and appending to the row
      const actionCell = document.createElement("td");

      // Creating "Update Oracle" Button
      const updateButton = document.createElement("button");
      updateButton.textContent = "Update Oracle";
      updateButton.dataset.action = "updateOracle";
      updateButton.dataset.betId = betId;
      // TODO: Attach Event Listener for updating oracle.
      actionCell.appendChild(updateButton);

      // Creating "Cancel" Button
      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";
      cancelButton.dataset.action = "cancelBet";
      cancelButton.dataset.betId = betId;
      // TODO: Attach Event Listener for cancelling bet.
      actionCell.appendChild(cancelButton);

      // Appending actionCell to the row
      row.appendChild(actionCell);

      // Appending the row to the container
      userBetsContainer.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching user bets details:", error);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.textContent = "Error loading pending bets.";
    errorCell.colSpan = 5;
    errorRow.appendChild(errorCell);
    userBetsContainer.appendChild(errorRow);
  }
}

async function populateUserPastBets() {
  const userPastBetsContainer = document.getElementById("past-bets");
  const noPastBetsRow = document.getElementById("no-past-bets-row");
  // Clear existing children nodes, except the default row
  while (
    userPastBetsContainer.firstChild &&
    userPastBetsContainer.firstChild !== noPastBetsRow
  ) {
    userPastBetsContainer.removeChild(userPastBetsContainer.firstChild);
  }

  if (!account) {
    // if no account is connected, just show the default row.
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

    noPastBetsRow.style.display = "none"; // Hide default row

    for (const { id, status } of allBetsIds) {
      const betDetail = await tokenContract.readBet(id);
      const { alice, amount, bob, oracle } = betDetail;
      const formattedAmount = formatWeiToEther(amount);
      const truncatedOracle = truncateAddress(oracle);

      const row = document.createElement("tr");

      // Create and append cells in desired order
      appendCell(row, id); // Bet ID
      appendCell(row, formattedAmount); // Stake
      appendCell(row, alice); // Maker
      appendCell(row, bob || "N/A"); // Taker
      appendCell(row, truncatedOracle); // Oracle
      appendCell(row, status); // Outcome
      appendCell(row, "N/A"); // Payout (Adjust as per your logic)

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
  const formatted = parseFloat(ethers.utils.formatUnits(amountInWei, 18));
  return (
    (formatted < 1 ? formatted.toFixed(18) : Math.trunc(formatted)) + " $BET"
  );
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
