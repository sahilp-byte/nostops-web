import type { Metadata } from 'next';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import OrgSubNav from '@/components/org/OrgSubNav';
import CohortLanding from '@/components/org/CohortLanding';
import GuidesPromo from '@/components/GuidesPromo';
import { COHORT_COPY, cohortMetadata } from '@/lib/org/cohort-copy';
import { getShowcase, listProgrammes, showcaseCohort } from '@/lib/server/institutional';

export const dynamic = 'force-dynamic';

const COPY = COHORT_COPY.EDUCATIONAL_INSTITUTION;

export function generateMetadata(): Metadata {
  return cohortMetadata('EDUCATIONAL_INSTITUTION');
}

export default async function EducationalInstitutionsShowcasePage() {
  const [data, catalogue] = await Promise.all([getShowcase(), listProgrammes()]);
  const cohort = showcaseCohort(data, 'EDUCATIONAL_INSTITUTION');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: COPY.metaTitle,
    description: COPY.metaDesc,
    url: canonical(COPY.path),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'For Organisations', item: canonical('/for-organisations') },
        { '@type': 'ListItem', position: 3, name: 'For Educational Institutions', item: canonical(COPY.path) },
      ],
    },
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <OrgSubNav active="/for-organisations" />
      <CohortLanding copy={COPY} cohort={cohort} catalogue={catalogue} />
      <GuidesPromo
        slugs={['yoga-for-educational-institutions', 'corporate-yoga-programmes', 'yoga-for-startups-and-networking-groups']}
        heading="Related guides"
      />
    </>
  );
}
