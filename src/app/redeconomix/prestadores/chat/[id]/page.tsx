import ChatPage from './chat-content';

export function generateStaticParams() {
    return [{ id: 'static' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ChatPage params={params} />;
}
