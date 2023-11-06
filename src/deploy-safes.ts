import * as dotenv from "dotenv";
import { User } from "../types";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

import { SafeAccountConfig, EthersAdapter, SafeFactory } from '@safe-global/protocol-kit'

const THRESHOLD = 2;

dotenv.config();

async function main() {

  // Create a single supabase client with admin rights
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        persistSession: false,
      },
    }
  );

  const approvedProposals = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("approved", true); // Filter for approved = true;

  const usersWithoutSafe = await supabaseAdmin
    .from("users")
    .select("*")
    .is("safe_address", null);

  let safelessUsers:User[] = [];
  
  for (const user of usersWithoutSafe.data!) {
    // filter approvedProposals where user is the author
    const proposalsByUser = approvedProposals.data!.filter(
      (proposal: any) => proposal.author_id === user.id
    );

    if (proposalsByUser.length > 0) {
      safelessUsers.push({
        id: user.id,
        address: user.address,
      });
    }
  }
  
  console.log(safelessUsers);

  await deploySafes(safelessUsers, supabaseAdmin);
}

const deploySafes = async (
  users: User[],
  supabase: SupabaseClient
) => {

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.INFURA_RPC_URL as string
  );

  const signer = new ethers.Wallet(
    process.env.SIGNER_PRIVATE_KEY as string,
    provider
  );
  
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer
  })

  const safeFactory: SafeFactory = await SafeFactory.create({ ethAdapter });

  for (const user of users) {
    let newSafeAddress;
    
    try {
      const safeAccountConfig: SafeAccountConfig = {
        owners: [
          user.address,
          process.env.IMPACT_STREAM_MULTISIG_ADDRESS as string,
        ],
        threshold: THRESHOLD,
      };

      const sdk = await safeFactory.deploySafe({ safeAccountConfig });

      newSafeAddress = await sdk.getAddress();

      try {
    
        const { error } = await supabase
          .from("users")
          .update({ safe_address: newSafeAddress })
          .eq("id", user.id);

        if (error) throw error;
        console.info(`UserId: ${user.id}. SafeAddress: ${newSafeAddress}`);
      } catch (error) {
        console.error(`DB Update Failure. UserId: ${user.id}`);
        console.error(error);
      }
    } catch (error) {
      console.info(`Creation Failure: UserId: ${user.id}`);
      console.error(error);
    }

  }

};

main();
