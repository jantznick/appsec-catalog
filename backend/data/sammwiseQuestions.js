// Question set adapted from OWASP SAMMwise under the Apache License 2.0.
// Source: https://github.com/owaspsamm/sammwise
export const SAMMWISE_QUESTIONS = {
  "governance-1": {
    "practiceName": "Strategy and Metrics",
    "questions": [
      {
        "id": "64f49a28334e4a40a04e534225a941d2",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you understand the enterprise-wide risk appetite for your applications ?",
        "description": "You capture the risk appetite of your organization's executive leadership",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, it covers general risks"
          },
          {
            "value": 0.5,
            "text": "Yes, it covers organization-specific risks"
          },
          {
            "value": 1,
            "text": "Yes, it covers risks and opportunities"
          }
        ]
      },
      {
        "id": "8fd0374f0b63476eacb3cadca99b1538",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you have a strategic plan for application security and use it to make decisions?",
        "description": "The plan reflects the organization's business priorities and risk appetite",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, we review it annually"
          },
          {
            "value": 0.5,
            "text": "Yes, we consult the plan before making significant decisions"
          },
          {
            "value": 1,
            "text": "Yes, we consult the plan often, and it is aligned with our application security strategy"
          }
        ]
      },
      {
        "id": "74eaee0cbf454a46adeb2619850bbcb3",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you regularly review and update the Strategic Plan for Application Security?",
        "description": "You review and update the plan in response to significant changes in the business environment, the organization, or its risk appetite",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but review is ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we review it at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we review it at least annually"
          }
        ]
      },
      {
        "id": "6aa85d5f3c03428aa064447fa50fa66b",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you use a set of metrics to measure the effectiveness and efficiency of the application security program across applications?",
        "description": "You document each metric, including a description of the sources, measurement coverage, and guidance on how to use it to explain application security trends",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for one metrics category"
          },
          {
            "value": 0.5,
            "text": "Yes, for two metrics categories"
          },
          {
            "value": 1,
            "text": "Yes, for all three metrics categories"
          }
        ]
      },
      {
        "id": "26f12b057f2b44f386d9af391383b590",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Did you define Key Perfomance Indicators (KPI) from available application security metrics?",
        "description": "You defined KPIs after gathering enough information to establish realistic objectives",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of the metrics"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the metrics"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the metrics"
          }
        ]
      },
      {
        "id": "efdc34fbb75b405b8107d63d58fa7286",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you update the Application Security strategy and roadmap based on application security metrics and KPIs?",
        "description": "You review KPIs at least yearly for their efficiency and effectiveness",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but review is ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we review it at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we review it at least annually"
          }
        ]
      }
    ]
  },
  "governance-2": {
    "practiceName": "Policy and Compliance",
    "questions": [
      {
        "id": "d15bfcd426d24a43b9417a0464b3af44",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you have and apply a common set of policies and standards throughout your organization?",
        "description": "You have adapted existing standards appropriate for the organizationâ€™s industry to account for domain-specific considerations",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "54aca12ea18e4073becbdd356cd3b3ef",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you publish the organization's policies as test scripts or run-books for easy interpretation by development teams?",
        "description": "You create verification checklists and test scripts where applicable, aligned with the policy's requirements and the implementation guidance in the associated standards",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some content"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the content"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the content"
          }
        ]
      },
      {
        "id": "073b78f0ce314757a05b15d9c6f96703",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you regularly report on policy and standard compliance, and use that information to guide compliance improvement efforts?",
        "description": "You have procedures (automated, if possible) to regularly generate compliance reports",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but reporting is ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we report at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we report at least annually"
          }
        ]
      },
      {
        "id": "4bb7dd93f5874730bd84b41cb56ce60a",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you have a complete picture of your external compliance obligations?",
        "description": "You have identified all sources of external compliance obligations",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "84d5a7f8d9e647db95288329f64fc41d",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you have a standard set of security requirements and verification procedures addressing the organization's external compliance obligations?",
        "description": "You map each external compliance obligation to a well-defined set of application requirements",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some obligations"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the obligations"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the obligations"
          }
        ]
      },
      {
        "id": "6a81ec4bcd1f43de95b91a7f50a40244",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly report on adherence to external compliance obligations and use that information to guide efforts to close compliance gaps?",
        "description": "You have established, well-defined compliance metrics",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but reporting is ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we report at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we report at least annually"
          }
        ]
      }
    ]
  },
  "governance-3": {
    "practiceName": "Education and Guidance",
    "questions": [
      {
        "id": "3d801ea0b0ad4c44ba2b0408ebcc750b",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you require employees involved with application development to take SDLC training?",
        "description": "Training is repeatable, consistent, and available to anyone involved with software development lifecycle",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "1962ef9fe4cf488a8d10ccbcdc8bb926",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Is training customized for individual roles such as developers, testers, or security champions?",
        "description": "Training includes all topics from maturity level 1, and adds more specific tools, techniques, and demonstrations",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of the training"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the training"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the training"
          }
        ]
      },
      {
        "id": "c7147e96d99849a994e63d5732c26220",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Have you implemented a Learning Management System or equivalent to track employee training and certification processes?",
        "description": "A Learning Management System (LMS) is used to track trainings and certifications",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of the training"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the training"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the training"
          }
        ]
      },
      {
        "id": "21a9b65765a844e0b27a074f2b4306a1",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Have you identified a Security Champion for each development team?",
        "description": "Security Champions receive appropriate training",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some teams"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the teams"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the teams"
          }
        ]
      },
      {
        "id": "fe0485b5026d4b2b9a7c99260addc912",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Does the organization have a Secure Software Center of Excellence (SSCE)?",
        "description": "The SSCE has a charter defining its role in the organization",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, we started implementing it"
          },
          {
            "value": 0.5,
            "text": "Yes, for part of the organization"
          },
          {
            "value": 1,
            "text": "Yes, for the entire organization"
          }
        ]
      },
      {
        "id": "871a30e6aaef4905a3d3302ceea808f4",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Is there a centralized portal where developers and application security professionals from different teams and business units are able to communicate and share information?",
        "description": "The organization promotes use of a single portal across different teams and business units",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, we started implementing it"
          },
          {
            "value": 0.5,
            "text": "Yes, for part of the organization"
          },
          {
            "value": 1,
            "text": "Yes, for the entire organization"
          }
        ]
      }
    ]
  },
  "design-1": {
    "practiceName": "Threat Assessment",
    "questions": [
      {
        "id": "71c02652a9ba4b10a0cc0179c7ce869f",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you classify applications according to business risk based on a simple and predefined set of questions?",
        "description": "An agreed-upon risk classification exists",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "897306b66f16454eab7b5a2355d31c11",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you use centralized and quantified application risk profiles to evaluate business risk?",
        "description": "The application risk profile is in line with the organizational risk standard",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "7e541611f3c749f285ac27f0a9ba7d55",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you regularly review and update the risk profiles for your applications?",
        "description": "The organizational risk standard considers historical feedback to improve the evaluation method",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, sporadically"
          },
          {
            "value": 0.5,
            "text": "Yes, upon change of the application"
          },
          {
            "value": 1,
            "text": "Yes, at least annually"
          }
        ]
      },
      {
        "id": "e9dcf4f79e2e487fb74df5e15a14a91b",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you identify and manage architectural design flaws with threat modeling?",
        "description": "You perform threat modeling for high-risk applications",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "42cfabd13db34fd0b35e92af917eb1b8",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you use a standard methodology, aligned on your application risk levels?",
        "description": "You train your architects, security champions, and other stakeholders on how to do practical threat modeling",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "cd639e5458ca4f60be60bc9d47314648",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly review and update the threat modeling methodology for your applications?",
        "description": "The threat model methodology considers historical feedback for improvement",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but review is ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we review it at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we review it at least annually"
          }
        ]
      }
    ]
  },
  "design-2": {
    "practiceName": "Security Requirements",
    "questions": [
      {
        "id": "645207bf33584cc6a535e42bae7667c9",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do project teams specify security requirements during development?",
        "description": "Teams derive security requirements from functional requirements and customer or organization concerns",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "2d458a65858c48af94f25f9858bd8ed7",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you define, structure, and include prioritization in the artifacts of the security requirements gathering process?",
        "description": "Security requirements take into consideration domain specific knowledge when applying policies and guidance to product development",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      },
      {
        "id": "dad421c501994b0fa2b2ab94ffe61176",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you use a standard requirements framework to streamline the elicitation of security requirements?",
        "description": "A security requirements framework is available for project teams",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "795e7ddd03f2443c851e34fc6e023d71",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do stakeholders review vendor collaborations for security requirements and methodology?",
        "description": "You consider including specific security requirements, activities, and processes when creating third-party agreements",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      },
      {
        "id": "dffdd9659e6243d7bcbcbc0dff4429fc",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do vendors meet the security responsibilities and quality measures of service level agreements defined by the organization?",
        "description": "You discuss security requirements with the vendor when creating vendor agreements",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      },
      {
        "id": "497753e656514aa6bdf3030bebcb3fbe",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Are vendors aligned with standard security controls and software development tools and processes that the organization utilizes?",
        "description": "The vendor has a secure SDLC that includes secure build, secure deployment, defect management, and incident management that align with those used in your organization",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      }
    ]
  },
  "design-3": {
    "practiceName": "Security Architecture",
    "questions": [
      {
        "id": "c4eb5618d1814173a995f8aea96f1c0b",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do teams use security principles during design?",
        "description": "You have an agreed upon checklist of security principles",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "3f1a3a84c85f4e339bcc5c9ecca5c73a",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you use shared security services during design?",
        "description": "You have a documented list of reusable security services, available to relevant stakeholders",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "cb88049632b54a15b3d610c4d492e83e",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you base your design on available reference architectures?",
        "description": "You have one or more approved reference architectures documented and available to stakeholders",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "47c8fb0cae5944d090d7f73f7632dc9f",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you evaluate the security quality of important technologies used for development?",
        "description": "You have a list of the most important technologies used in or in support of each application",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b63b5fa0f5bc455bb5b1dd9168c44000",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you have a list of recommended technologies for the organization?",
        "description": "The list is based on technologies used in the software portfolio",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of the technology domains"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the technology domains"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the technology domains"
          }
        ]
      },
      {
        "id": "f4722a4fdfc44a45be5b5ee8dd7b735f",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you enforce the use of recommended technologies within the organization?",
        "description": "You monitor applications regularly for the correct use of the recommended technologies",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      }
    ]
  },
  "implementation-1": {
    "practiceName": "Secure Build",
    "questions": [
      {
        "id": "70d6044a223b402c8e2b6f9d1e936641",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Is your full build process formally described?",
        "description": "You have enough information to recreate the build processes",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b5d33583538b4878bb4674a5f838b8ea",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Is the build process fully automated?",
        "description": "The build process itself doesn't require any human interaction",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "ee775955bf7f48d294c75f6384232f48",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you enforce automated security checks in your build processes?",
        "description": "Builds fail if the application doesn't meet a predefined security baseline",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "1e28b82cc3ba4e4ea2552746e17c25af",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you have solid knowledge about dependencies you're relying on?",
        "description": "You have a current bill of materials (BOM) for every application",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "ef798e60155d453186364c94a8f8935d",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you handle 3rd party dependency risk by a formal process?",
        "description": "You keep a list of approved dependencies that meet predefined criteria",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "418e98e2939546e69a24d0c3c4c8d217",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you prevent build of software if it's affected by vulnerabilities in dependencies?",
        "description": "Your build system is connected to a system for tracking 3rd party dependency risk, causing build to fail unless the vulnerability is evaluated to be a false positive or the risk is explicitly accepted",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      }
    ]
  },
  "implementation-2": {
    "practiceName": "Secure Deployment",
    "questions": [
      {
        "id": "24697d43707b4d83a6a5819a9db9a75d",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you use repeatable deployment processes?",
        "description": "You have enough information to run the deployment processes",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "7ef6753cda0d4da6ad194e56650f584d",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Are deployment processes automated and employing security checks?",
        "description": "Deployment processes are automated on all stages",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "f87fddbf283a4c38b45a3125d827dd27",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you consistently validate the integrity of deployed artifacts?",
        "description": "You prevent or roll back deployment if you detect an integrity breach",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "37c6a5618a6344b386eb872619cfe53f",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you limit access to application secrets according to the least privilege principle?",
        "description": "You store production secrets protected in a secured location",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "c5f66e97db174d8c9dc2d82fbad9d4e3",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you inject production secrets into configuration files during deployment?",
        "description": "Source code files no longer contain active application secrets",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "50af7a14ddf2408fb4576e3972cf13e3",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you practice proper lifecycle management for application secrets?",
        "description": "You generate and synchronize secrets using a vetted solution",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      }
    ]
  },
  "implementation-3": {
    "practiceName": "Defect Management",
    "questions": [
      {
        "id": "7f92b3f940cb4229a6079016269d76c6",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you track all known security defects in accessible locations?",
        "description": "You can easily get an overview of all security defects impacting one application",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "5b333ff2dd474381b0af595ff13dcdcf",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you keep an overview of the state of security defects across the organization?",
        "description": "A single severity scheme is applied to all defects across the organization",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "6b5eac7b9e2f49e2a2cda600ef70ad99",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you enforce SLAs for fixing security defects?",
        "description": "You automatically alert of SLA breaches and transfer respective defects to the risk management process",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "29df0959af8f403383c8ad01a0f3c478",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you use basic metrics about recorded security defects to carry out quick win improvement activities?",
        "description": "You analyzed your recorded metrics at least once in the last year",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "1a849e8fd3ae41a4b3675947482426da",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you improve your security assurance program upon standardized metrics?",
        "description": "You document metrics for defect classification and categorization and keep them up to date",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "0247b5b573b843609fdff791a1cc7c1b",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly evaluate the effectiveness of your security metrics so that its input helps drive your security strategy?",
        "description": "You have analyzed the effectivenss of the security metrics at least once in the last year",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      }
    ]
  },
  "verification-1": {
    "practiceName": "Architecture Assessment",
    "questions": [
      {
        "id": "2da7acf355814b75ab971fec36048f11",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you review the application architecture for key security objectives on an ad-hoc basis?",
        "description": "You have an agreed upon model of the overall software architecture",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b133d28653bc47a8a8574d1c60ec34f0",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you regularly review the security mechanisms of your architecture?",
        "description": "You review compliance with internal and external requirements",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "ba213b2d5fc844a386010ca53cf87fb8",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you regularly review the effectiveness of the security controls?",
        "description": "You evaluate the preventive, detective, and response capabilities of security controls",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b920062a62d84883af0c167955ec10de",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you review the application architecture for mitigations of typical threats on an ad-hoc basis?",
        "description": "You have an agreed upon model of the overall software architecture",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "2784c6272d174dcf932b188a69a8917d",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you regularly evaluate the threats to your architecture?",
        "description": "You systematically review each threat identified in the Threat Assessment",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "df317b6ac5de4815a1ba7ac558d0263e",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly update your reference architectures based on architecture assessment findings?",
        "description": "You assess your architectures in a standardized, documented manner",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      }
    ]
  },
  "verification-2": {
    "practiceName": "Requirements-driven Testing",
    "questions": [
      {
        "id": "cb085e0a25724700bc10c73cfcc8f6a5",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you test applications for the correct functioning of standard security controls?",
        "description": "Security testing at least verifies the implementation of authentication, access control, input validation, encoding and escaping data, and encryption controls",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "d6b26a63243d4142bd2a8317e2875a03",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you consistently write and execute test scripts to verify the functionality of security requirements?",
        "description": "You tailor tests to each application and assert expected security functionality",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "35413be30d9f415dbde45edbe3b17f31",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you automatically test applications for security regressions?",
        "description": "You consistently write tests for all identified bugs (possibly exceeding a pre-defined severity threshhold)",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "749893a53df24c32bc887b6d5f7b3f7b",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you test applications using randomization or fuzzing techniques?",
        "description": "Testing covers most or all of the application's main input parameters",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b2afb33fe6ef4b6e90e029059f7a7124",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you create abuse cases from functional requirements and use them to drive security tests?",
        "description": "Important business functionality has corresponding abuse cases",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      },
      {
        "id": "814caca2fc5241dcb90c48302ac031b2",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you perform denial of service and security stress testing?",
        "description": "Stress tests target specific application resources (e.g. memory exhaustion by saving large amounts of data to a user session)",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      }
    ]
  },
  "verification-3": {
    "practiceName": "Security Testing",
    "questions": [
      {
        "id": "bef645da8ccd477bbd10685dd52ad40e",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you scan applications with automated security testing tools?",
        "description": "You dynamically generate inputs for security tests using automated tools",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "c013b6f9d973425cb63f21f4f8b84c30",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you customize the automated security tools to your applications and technology stacks?",
        "description": "You tune and select tool features which match your application or technology stack",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of them"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of them"
          },
          {
            "value": 1,
            "text": "Yes, most or all of them"
          }
        ]
      },
      {
        "id": "009a8fafe5dd41889947a6b2c6769bbe",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you integrate automated security testing into the build and deploy process?",
        "description": "Management and business stakeholders track and review test results throughout the development cycle",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of it"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of it"
          },
          {
            "value": 1,
            "text": "Yes, most or all of it"
          }
        ]
      },
      {
        "id": "77dd81adf35f43608408e548c4972136",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you manually review the security quality of selected high-risk components?",
        "description": "Criteria exist to help the reviewer focus on high-risk components",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "9a2af155ba424edfb321aa7592a09ed5",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you perform penetration testing for your applications at regular intervals?",
        "description": "Penetration testing uses application-specific security test cases to evaluate security",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "b73bf8f0462340659e252e6471c6e831",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you use the results of security testing to improve the development lifecycle?",
        "description": "You use results from other security activities to improve integrated security testing during development",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, but we improve it ad-hoc"
          },
          {
            "value": 0.5,
            "text": "Yes, we we improve it at regular times"
          },
          {
            "value": 1,
            "text": "Yes, we improve it at least annually"
          }
        ]
      }
    ]
  },
  "operations-1": {
    "practiceName": "Incident Management",
    "questions": [
      {
        "id": "1e005e11997f4929a12fdb939599e77e",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you analyze log data for security incidents periodically?",
        "description": "You have a contact point for the creation of security incidents",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "13b9816c06444ba99584e657bfa5833d",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you follow a documented process for incident detection?",
        "description": "The process has a dedicated owner",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "09744a244f8d4076bec35130da92ea2b",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you review and update the incident detection process regularly?",
        "description": "You perform reviews at least annually",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "0d889a913d484eb39b80f096f3a66019",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you respond to detected incidents?",
        "description": "You have a defined person or role for incident handling",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some incidents"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the incidents"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the incidents"
          }
        ]
      },
      {
        "id": "dbb83b0d5b504db6a170710df4df347f",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you use a repeatable process for incident handling?",
        "description": "You have an agreed upon incident classification",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some incident types"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the incident types"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the incident types"
          }
        ]
      },
      {
        "id": "91bd2bdc1c734d8dbffc30e37158ab00",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you have a dedicated incident response team available?",
        "description": "The team performs Root Cause Analysis for all security incidents unless there is a specific reason not to do so",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      }
    ]
  },
  "operations-2": {
    "practiceName": "Environmental Management",
    "questions": [
      {
        "id": "1e005e11997f4929a12fdb939599e77e",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you harden configurations for key components of your technology stacks?",
        "description": "You have identified the key components in each technology stack used",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "41d33402a94c49538554ce77e9de6a72",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you have hardening baselines for your components?",
        "description": "You have assigned an owner for each baseline",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "f4ec030280ee417099eaf12752a542ae",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you monitor and enforce conformity with hardening baselines?",
        "description": "You perform conformity checks regularly, preferably using automation",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "180e194b165d421c9d2c89258195a792",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you identify and patch vulnerable components?",
        "description": "You have an up-to-date list of components, including version information",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "0844b1a3be8b49ec83c7377a9f797cfc",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you follow an established process for updating components of your technology stacks?",
        "description": "The process includes vendor information for third-party patches",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      },
      {
        "id": "6e72179a31c04024bb649346bfb03eb5",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly evaluate components and review patch level status?",
        "description": "You update the list with components and versions",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some components"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the components"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the components"
          }
        ]
      }
    ]
  },
  "operations-3": {
    "practiceName": "Operational Management",
    "questions": [
      {
        "id": "41b0c2ab37774000b2b81077605bbd93",
        "stream": "A",
        "maturityLevel": 1,
        "title": "Do you protect and handle information according to protection requirements for data stored and processed on each application?",
        "description": "You know the data elements processed and stored by each application",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "424c004afec041058e89c396c9e88930",
        "stream": "A",
        "maturityLevel": 2,
        "title": "Do you maintain a data catalog, including types, sensitivity levels, and processing and storage locations?",
        "description": "The data catalog is stored in an accessible location",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of our data"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of our data"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of our data"
          }
        ]
      },
      {
        "id": "8176c4588bdd4e979e3c82566450696a",
        "stream": "A",
        "maturityLevel": 3,
        "title": "Do you regularly review and update the data catalog and your data protection policies and procedures?",
        "description": "You have automated monitoring to detect attempted or actual violations of the Data Protection Policy",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, we do it when requested"
          },
          {
            "value": 0.5,
            "text": "Yes, we do it every few years"
          },
          {
            "value": 1,
            "text": "Yes, we do it at least annually"
          }
        ]
      },
      {
        "id": "b50d81aba3734cb59d618fd74bc5c99e",
        "stream": "B",
        "maturityLevel": 1,
        "title": "Do you identify and remove systems, applications, application dependencies, or services that are no longer used, have reached end of life, or are no longer actively developed or supported?",
        "description": "You do not use unsupported applications or dependencies",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some applications"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the applications"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the applications"
          }
        ]
      },
      {
        "id": "f9c5a8649ddf4168b6f62d0018a32704",
        "stream": "B",
        "maturityLevel": 2,
        "title": "Do you follow an established process for removing all associated resources, as part of decommissioning of unused systems, applications, application dependencies, or services?",
        "description": "You document the status of support for all released versions of your products, in an accessible location",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, some of the time"
          },
          {
            "value": 0.5,
            "text": "Yes, at least half of the time"
          },
          {
            "value": 1,
            "text": "Yes, most or all of the time"
          }
        ]
      },
      {
        "id": "54ad3e4182844623b3290901c1a1932d",
        "stream": "B",
        "maturityLevel": 3,
        "title": "Do you regularly evaluate the lifecycle state and support status of every software asset and underlying infrastructure component, and estimate their end of life?",
        "description": "Your end of life management process is agreed upon",
        "choices": [
          {
            "value": 0,
            "text": "No"
          },
          {
            "value": 0.25,
            "text": "Yes, for some of the assets"
          },
          {
            "value": 0.5,
            "text": "Yes, for at least half of the assets"
          },
          {
            "value": 1,
            "text": "Yes, for most or all of the assets"
          }
        ]
      }
    ]
  }
};

export const SAMMWISE_TOTAL_QUESTIONS = Object.values(SAMMWISE_QUESTIONS)
  .reduce((total, practice) => total + practice.questions.length, 0);

export const SAMM_STREAM_NAMES = {
  'governance-1': ['Create & Promote', 'Measure & Improve'],
  'governance-2': ['Policy & Standards', 'Compliance Management'],
  'governance-3': ['Training & Awareness', 'Organization & Culture'],
  'design-1': ['Application Risk Profile', 'Threat Modeling'],
  'design-2': ['Software Requirements', 'Supplier Security'],
  'design-3': ['Architecture Design', 'Technology Management'],
  'implementation-1': ['Build Process', 'Software Dependencies'],
  'implementation-2': ['Deployment Process', 'Secret Management'],
  'implementation-3': ['Defect Tracking', 'Metrics & Feedback'],
  'verification-1': ['Architecture Validation', 'Architecture Compliance'],
  'verification-2': ['Control Verification', 'Misuse/Abuse Testing'],
  'verification-3': ['Scalable Baseline', 'Deep Understanding'],
  'operations-1': ['Incident Detection', 'Incident Response'],
  'operations-2': ['Configuration Hardening', 'Patch & Update'],
  'operations-3': ['Data Protection', 'Legacy Management'],
};
