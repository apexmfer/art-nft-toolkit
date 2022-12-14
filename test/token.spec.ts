 
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
 
import { BigNumber, utils, Wallet } from 'ethers'
import { AbiCoder } from 'ethers/lib/utils'

import hre, { ethers, getNamedAccounts ,getNamedSigner} from 'hardhat'
 
//import { deploy } from 'helpers/deploy-helpers'
import { DetroitLocalArt } from '../generated/typechain'
import { deploy } from '../helpers/deploy-helpers'
import { generateArtSignature, generateRandomNonce } from '../lib/art-signature-tools'
import { calculateProjectIdHash, generateRandomProjectSeed } from './lib/local-art-utils'
import { createAndFundRandomWallet } from './lib/test-utils' 
 
const crypto = require('crypto')

chai.should()
chai.use(chaiAsPromised)

const {   deployments } = hre

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SetupOptions {}

interface SetupReturn {
  artContract: DetroitLocalArt 
}

const setup = deployments.createFixture<SetupReturn, SetupOptions>(
  async (hre, _opts) => {
   
   
    await hre.deployments.fixture(['primary'], {
      keepExistingDeployments: false,
    })

    const artContract = await hre.contracts
    .get<DetroitLocalArt>('DetroitLocalArt')

    return {
      artContract
    }
  }
)



describe('Upgrade Contract', () => {

  let artContract: DetroitLocalArt 
  
  let deployer: Wallet
  let artist: Wallet 
  let minter: Wallet  

  let projectSeed : string; 

    before(async () => {
      
      deployer = await getNamedSigner('deployer')

      artist = await createAndFundRandomWallet( ethers.provider )
      minter = await createAndFundRandomWallet( ethers.provider )
     
      //let minerEth = await miner.getBalance()

      const result = await setup()
      artContract = result.artContract

     })


  

    it('should create a project', async () => { 

    
      console.log('deployer',await deployer.getAddress())

      let artistAddress = await artist.getAddress()
      let metadataURI = "ipfs://"
      let totalSupply = 10
      let mintPrice = 0
      projectSeed = generateRandomProjectSeed()

      console.log({projectSeed}, projectSeed.length)
      
      await artContract.connect(deployer).defineProject(
        artistAddress,
        artistAddress,
        metadataURI,
        totalSupply,
        mintPrice,
        utils.arrayify(projectSeed)
      )


      //calc project id from inputs 
      let projectId = calculateProjectIdHash( artistAddress,totalSupply,projectSeed  ) 

      console.log({projectId})

      let projectData = await artContract.artProjects(projectId);
 

      projectData.signerAddress.should.eql(artistAddress)
      projectData.metadataURI.should.eql(metadataURI)
      projectData.totalSupply.should.eql(totalSupply)
      
    })
  
    it('should mint a token', async () => { 

      let chainId = hre.network.config.chainId

      let contractAddress = artContract.address
     // let implementationContractAddress =  await artContract.getImplementationAddress()

 
      if(!chainId){
        throw new Error("ChainId undefined")
      }

      let artistAddress = await artist.getAddress()
      let totalSupply = 10


      let projectId = calculateProjectIdHash( artistAddress,totalSupply,projectSeed  ) 

      let nonce = generateRandomNonce();
      let signatureResponse = generateArtSignature( artist, projectId, nonce, chainId, contractAddress)
      
      
      if(!signatureResponse.data){
        console.log(signatureResponse)
        throw new Error("Signature failure")
      }
      
      
      let signature = signatureResponse.data.signature

      if(!signature){
        throw new Error("Signature undefined")
      } 


      let typeHash = await artContract.getTypeHash(projectId,nonce);

     // console.log({typeHash})
      

     // let domainSeparator = await artContract['DOMAIN_SEPARATOR']();
      
      let mint = await artContract.connect(minter).mintToken(
        projectId,
        nonce,
        signature
      )

      let tokenId = 0; 

      let mintedTokenURI = await artContract.tokenURI( tokenId )

      expect(mintedTokenURI).to.eql('ipfs://')
 
    })

    it('should mint a token', async () => { 

      let chainId = hre.network.config.chainId
      let contractAddress =  artContract.address


      console.log({contractAddress})

      if(!chainId){
        throw new Error("ChainId undefined")
      }

      let signerAddress = await artist.getAddress()
      let totalSupply = 10


      let projectId = calculateProjectIdHash( signerAddress,totalSupply,projectSeed  ) 



      let nonce = generateRandomNonce();
      let signatureResponse = generateArtSignature( artist, projectId,nonce, chainId, contractAddress)

      if(!signatureResponse.data){
        console.log(signatureResponse)
        throw new Error("Signature failure")
      }
      
      let signature = signatureResponse.data.signature
      let secretMessage = signatureResponse.data.secretMessage
      
      if(!signature){
        throw new Error("Signature undefined")
      }


      let typeHash = await artContract.getTypeHash(projectId,nonce);
      
     // let domainSeparator = await artContract['DOMAIN_SEPARATOR']();
       

     console.log({projectId})

     console.log({nonce})
      console.log({secretMessage})

     /* const abiCoder = new utils.AbiCoder()

    
      let secretMessageUnpacked =   abiCoder.decode(['uint16','uint16','bytes'],secretMessage)


      console.log({secretMessageUnpacked})*/

      let mint = await artContract.connect(minter).mintTokenFromSecretMessage(
       secretMessage
      )


      let tokenId = 1; 

      let mintedTokenURI = await artContract.tokenURI( tokenId )

      expect(mintedTokenURI).to.eql('ipfs://')



    })
  
})
