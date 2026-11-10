import RutaPage from './ruta-content';

export function generateStaticParams() {
    return [{ id: 'static' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
    return <RutaPage params={params} />;
}
