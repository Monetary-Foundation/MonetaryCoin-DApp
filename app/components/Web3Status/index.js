/**
*
* Web3Status
*
*/
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Col } from 'antd';
const Token = styled.div`
  font-size: 330%;
`;

function Web3Status(props) {
  const {
    initStatus,
    web3,
    // networkName,
    tokenName,
    tokenAddress,
    // tokenList,
  } = props;

  if (initStatus === 'loading') {
    return <div> init in progress, check Mist/Metamask is connected to a network ....</div>;
  }

  if (initStatus === 'error') {
    return <div> {web3} </div>;
  }

  const provider = web3 && web3.currentProvider && web3.currentProvider.constructor.name;
  return (
    <Col sm={{ span: 10, offset: 1 }} xs={{ span: 23, offset: 1 }}>
      <Token>
        {tokenName}
      </Token>
      Token Contract: <br /> {tokenAddress} <br /> <br />
      Web3 Provider: <br /> {provider || 'no web3 provider specified'} <br />
    </Col>
  );
}

Web3Status.propTypes = {
  initStatus: PropTypes.string,
  web3: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  networkName: PropTypes.string,
  tokenName: PropTypes.string,
  tokenAddress: PropTypes.string,
  distributionAddress: PropTypes.string,
  tokenList: PropTypes.array,
};

export default Web3Status;
