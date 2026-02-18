import { redirect } from 'next/navigation';

export default function PDVPage() {
  redirect('/loja?tab=pos');
}
