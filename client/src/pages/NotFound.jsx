import { Link } from 'react-router-dom';
export default function NotFound({ forbidden }) {
  return <div className="card center"><h1>{forbidden ? 'Not allowed' : 'Page not found'}</h1><p className="muted">{forbidden ? 'Your role does not have access to this page.' : 'The page you are looking for does not exist.'}</p><Link className="btn" to="/">Go to the dashboard</Link></div>;
}
