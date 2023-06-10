import { Provider } from '@/context/context'
import GeneSplitterForm from '@/components/gene-splitter-form'
import Head from 'next/head'
import Layout from '@/components/layout'

export default function Home() {
  return (
    <>
      <Head>
        <title>RNA End-joining Design Tool</title>
      </Head>
      <Provider>
        <Layout>
          <GeneSplitterForm />
        </Layout>
      </Provider>
    </>
  )
}
