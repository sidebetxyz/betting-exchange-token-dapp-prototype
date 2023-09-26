// Get references to HTML elements
const connectButton = document.getElementById("connect-button");
const accountInfo = document.getElementById("account-info");
const networkInfo = document.getElementById("network-info");
const form = document.getElementById("bet-form");

const tokenAddress = "0x4f5d4a27625cd12c8582e0ea390542a787d5d8f2";
const DEFAULT_ORACLE_ADDRESS = "0x0000000000000000000000000000000000000000";

let tokenABI, tokenContract;
let provider, signer, account;
let betIds = [];
console.log(provider);
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
    console.log(provider);

    provider = await new ethers.BrowserProvider(window.ethereum);
    console.log("P2", provider);

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

    console.log("END OF INIT");
    console.log(provider);

    // Error out if initialization fails
  } catch (error) {
    console.error(error);
  }
}

// Function to load ABI and initialize contract instance
async function loadContractInfo(connectedTo) {
  console.log(provider);

  if (!tokenABI) {
    tokenABI = await loadABI("TestingBettingExchangeToken.json");
  }

  if (!tokenContract) {
    tokenContract = new ethers.Contract(tokenAddress, tokenABI, connectedTo);
  }

  try {
    const tokenSymbol = await tokenContract.symbol();
    console.log("Token Symbol:", tokenSymbol);
  } catch (error) {
    console.error("Error fetching token symbol:", error);
  }

  try {
    const tokenDecimals = await tokenContract.decimals();
    console.log("Token Decimals:", tokenDecimals);
  } catch (error) {
    console.error("Error fetching token decimals:", error);
  }

  try {
    const bets = await fetchAvailableBets();
    betIds = [];
    for (let i = 0; i < bets.length; i++) {
      betIds.push(Number(bets[i]));
    }
    console.log("AVAILABLE BETS:", betIds);
  } catch (error) {
    console.error("Error fetching available bets:", error);
  }

  try {
    await populateAvailableBets();
  } catch {
    console.error("Error populating availiable bets:", error);
  }

  try {
    await populateUserBalance();
  } catch {
    console.error("Error populating BET balance:", error);
  }

  console.log("END OF CONTRACT INFO");
}

async function fetchAvailableBets() {
  const bets = await tokenContract.getAvailableBets();
  return bets;
}

async function populateAvailableBets() {
  const betsContainer = document.getElementById("available-bets");

  // Clearing out the default text if there are available bets
  if (betIds.length > 0) {
    betsContainer.innerHTML = "";
  }

  try {
    const betsDetails = await Promise.all(
      betIds.map((betId) => tokenContract.readBet(betId))
    );

    if (betsDetails.length === 0) {
      betsContainer.innerHTML = "No available bets at the moment.";
      return;
    }

    betsDetails.forEach((betDetail, index) => {
      const betElement = document.createElement("div");
      betElement.className = "bet";
      betElement.textContent = `Bet ID: ${betIds[index]} - Detail: ${betDetail}`;

      // Adding a Click Event to each Bet Element
      betElement.addEventListener("click", function () {
        alert(`Bet ID ${betIds[index]} clicked!`);
        // Replace the alert with any action you want to perform when a bet is clicked.
      });

      betsContainer.appendChild(betElement);
    });
  } catch (error) {
    console.error("Error fetching bet details:", error);
    betsContainer.innerHTML = "Error fetching available bets.";
  }
}

async function populateUserBalance() {
  if (account && tokenContract) {
    // Check if account is defined and tokenContract is initialized
    try {
      const balance = await tokenContract.balanceOf(account);
      const balanceElement = document.getElementById("bet-balance");
      console.log(balance);
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

// Function to handle changes in connected accounts
function handleAccountsChanged(account) {
  // If no account is connected, update the accountInfo text content
  if (!account) {
    console.log("Please connect to Wallet.");
    accountInfo.textContent = "Not connected";
    return;
  }

  // Log connected account and update the accountInfo text content
  console.log("Connected Account:", account);
  const checksumAddress = ethers.getAddress(account);
  console.log("Checksumed Address:", checksumAddress);
  accountInfo.textContent = `Connected: ${checksumAddress}`;
}

// Function to handle changes in the network chainId
function handleChainChanged(chainId) {
  // Log the changed chainId and update the networkInfo text content
  console.log("Chain changed to:", chainId);
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

// Attach listeners if wallet is detected and provide fallback provider if none is detected
if (typeof window.ethereum !== "undefined") {
  console.log("WALLET FOUND");
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
  console.log("NO WALLET FOUND");
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
