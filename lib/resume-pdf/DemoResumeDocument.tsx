import {
    Document,
    Link,
    Page,
    StyleSheet,
    Text,
    View,
    renderToBuffer,
} from "@react-pdf/renderer";

import type { ResumePdfModel } from "@/lib/resume-generate";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#111111",
    lineHeight: 1.35,
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8.5,
    textAlign: "center",
    color: "#333333",
    marginBottom: 4,
  },
  contact: {
    fontSize: 8.5,
    textAlign: "center",
    marginBottom: 3,
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 4,
  },
  link: {
    fontSize: 8.5,
    color: "#111111",
    textDecoration: "underline",
  },
  linkSep: {
    fontSize: 8.5,
    color: "#111111",
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 2,
  },
  bodyText: {
    fontSize: 9.5,
    textAlign: "justify",
  },
  eduRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  eduInstitution: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    flexGrow: 1,
    paddingRight: 8,
  },
  eduMeta: {
    fontSize: 9,
    textAlign: "right",
  },
  eduDegree: {
    fontSize: 9,
    marginBottom: 2,
  },
  skillLine: {
    fontSize: 9.5,
    marginBottom: 2,
  },
  skillLabel: {
    fontFamily: "Helvetica-Bold",
  },
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  roleTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    flexGrow: 1,
    paddingRight: 8,
  },
  roleDates: {
    fontSize: 9,
    textAlign: "right",
  },
  roleCompany: {
    fontSize: 9,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1.5,
    paddingLeft: 2,
  },
  bullet: {
    width: 10,
    fontSize: 9.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  },
});

function formatDateRange(
  start: string,
  end: string | null,
  isCurrent: boolean,
): string {
  const endLabel = isCurrent || !end ? "Present" : end;
  return `${start} – ${endLabel}`;
}

function DemoResumeDocument({ model }: { model: ResumePdfModel }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap={false}>
        <Text style={styles.name}>{model.full_name}</Text>
        {model.current_title ? (
          <Text style={styles.title}>{model.current_title}</Text>
        ) : null}
        {model.subtitle ? (
          <Text style={styles.subtitle}>{model.subtitle}</Text>
        ) : null}
        {model.contactParts.length > 0 ? (
          <Text style={styles.contact}>{model.contactParts.join(" | ")}</Text>
        ) : null}
        {model.links.length > 0 ? (
          <View style={styles.linksRow}>
            {model.links.map((link, index) => (
              <View
                key={`${link.label}-${link.url}`}
                style={{ flexDirection: "row" }}
              >
                {index > 0 ? <Text style={styles.linkSep}> | </Text> : null}
                <Link src={link.url} style={styles.link}>
                  {link.label}
                </Link>
              </View>
            ))}
          </View>
        ) : null}

        {model.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.bodyText}>{model.summary}</Text>
          </View>
        ) : null}

        {model.education ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            <View style={styles.eduRow}>
              <Text style={styles.eduInstitution}>
                {model.education.institution || model.education.degreeLine}
              </Text>
              {model.education.locationOrYear ? (
                <Text style={styles.eduMeta}>
                  {model.education.locationOrYear}
                </Text>
              ) : null}
            </View>
            {model.education.institution && model.education.degreeLine ? (
              <Text style={styles.eduDegree}>{model.education.degreeLine}</Text>
            ) : null}
          </View>
        ) : null}

        {model.skills_line || model.industries_line ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {model.skills_line ? (
              <Text style={styles.skillLine}>
                <Text style={styles.skillLabel}>Skills: </Text>
                {model.skills_line}.
              </Text>
            ) : null}
            {model.industries_line ? (
              <Text style={styles.skillLine}>
                <Text style={styles.skillLabel}>Industries: </Text>
                {model.industries_line}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {model.experience.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {model.experience.map((role, roleIndex) => (
              <View
                key={`${role.company}-${role.title}-${roleIndex}`}
                style={{ marginBottom: 6 }}
              >
                <View style={styles.roleHeader}>
                  <Text style={styles.roleTitle}>{role.title}</Text>
                  <Text style={styles.roleDates}>
                    {formatDateRange(
                      role.start_date,
                      role.end_date,
                      role.is_current,
                    )}
                  </Text>
                </View>
                <Text style={styles.roleCompany}>{role.company}</Text>
                {role.bullets.map((bullet, bulletIndex) => (
                  <View
                    key={`${roleIndex}-${bulletIndex}`}
                    style={styles.bulletRow}
                  >
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderResumePdfBuffer(
  model: ResumePdfModel,
): Promise<Buffer> {
  return renderToBuffer(<DemoResumeDocument model={model} />);
}
