import React from 'react';
import ReactDOM from 'react-dom/client';
import { Person } from '@nine-thirty-five/material-icons-react/rounded';
import { Home } from '@nine-thirty-five/material-icons-react/outlined';
import { Folder } from '@nine-thirty-five/material-icons-react/sharp';
import { Favorite } from '@nine-thirty-five/material-icons-react/filled';
import { Lock } from '@nine-thirty-five/material-icons-react/twotone';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <div>
      <Person height="4rem" width="4rem" fill="red" />
      <Home height="4rem" width="4rem" fill="blue" />
      <Folder height="4rem" width="4rem" fill="yellow" />
      <Favorite height="4rem" width="4rem" fill="green" />
      <Lock height="4rem" width="4rem" fill="purple" />
    </div>
  </React.StrictMode>
);
